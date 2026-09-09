import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractDocument, htmlToText } from "./extract.server";
import { runOpportunityAnalysis } from "./analysis/pipeline.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Client = SupabaseClient<Database>;

const MAX_FETCH_BYTES = 15 * 1024 * 1024; // 15 MB
const FETCH_TIMEOUT_MS = 12_000; // 12 seconds

/**
 * Checks whether an IPv4 or IPv6 address is private, loopback, link-local, or cloud metadata.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // Normalize IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  const cleanIp = ip.replace(/^::ffff:/i, "");

  // Check IPv4
  if (cleanIp.includes(".")) {
    const parts = cleanIp.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true; // invalid IP format treated as blocked
    }
    const [a, b] = parts;
    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 10.0.0.0/8 (Private network)
    if (a === 10) return true;
    // 172.16.0.0/12 (Private network: 172.16 - 172.31)
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (Private network)
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata service e.g. 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 (Shared address space)
    if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (a !== undefined && a >= 224) return true;
    return false;
  }

  // Check IPv6
  const lower = cleanIp.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // Loopback / unspecified
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // Unique local (fc00::/7)
  if (
    lower.startsWith("fe80") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  )
    return true; // Link-local (fe80::/10)
  if (lower.startsWith("ff")) return true; // Multicast
  return false;
}

/**
 * Validates that a target URL is strictly HTTP or HTTPS and does NOT target
 * loopback, internal infrastructure, private subnets, or cloud metadata endpoints.
 */
export async function validateSafeUrl(
  urlString: string,
): Promise<{ valid: boolean; reason?: string; parsed?: URL }> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, reason: "Invalid URL format." };
  }

  // Protocol check
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      valid: false,
      reason: `Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
    };
  }

  // Hostname string check
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "instance-data"
  ) {
    return { valid: false, reason: "Access to internal hostnames is prohibited." };
  }

  // Check if host is direct IP address
  if (isIP(host) !== 0) {
    if (isPrivateOrReservedIp(host)) {
      return { valid: false, reason: "Access to private or local IP addresses is prohibited." };
    }
  } else {
    // Resolve DNS to verify resolved IP is safe (prevents DNS rebinding and private domains)
    try {
      const { address } = await lookup(host);
      if (isPrivateOrReservedIp(address)) {
        return {
          valid: false,
          reason: `Resolved IP address "${address}" is in a restricted network range.`,
        };
      }
    } catch (e) {
      return { valid: false, reason: `Unable to resolve host "${host}": ${(e as Error).message}` };
    }
  }

  return { valid: true, parsed };
}

/**
 * Safely fetches remote tender content with SSRF guards, redirect checking,
 * timeouts, and byte limits.
 */
const BROWSER_HEADERS_PRIMARY: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

const BROWSER_HEADERS_FALLBACK: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Upgrade-Insecure-Requests": "1",
};

export const USER_FACING_URL_ERROR =
  "GetBidRadar couldn't retrieve this public page. Try uploading the tender document instead.";

/**
 * Extracts rich metadata (title, buyer, description, deadline) from HTML.
 */
export function extractHtmlMetadata(rawHtml: string): {
  title?: string | undefined;
  description?: string | undefined;
  buyer?: string | undefined;
  deadline?: string | undefined;
} {
  const getMeta = (prop: string) => {
    const m =
      new RegExp(
        `<meta\\s+[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
        "i",
      ).exec(rawHtml) ||
      new RegExp(
        `<meta\\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
        "i",
      ).exec(rawHtml);
    return m ? m[1]?.trim() : undefined;
  };

  const rawTitle =
    getMeta("og:title") ||
    getMeta("twitter:title") ||
    /<h1[^>]*>([^<]+)<\/h1>/i.exec(rawHtml)?.[1]?.trim() ||
    /<title[^>]*>([^<]+)<\/title>/i.exec(rawHtml)?.[1]?.trim();

  let cleanTitle = rawTitle;
  if (cleanTitle) {
    cleanTitle = cleanTitle
      .replace(/&amp;/g, "&")
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/\s+[—–-]\s+[A-Za-z0-9\s&]+$/, "")
      .replace(/\s+\|\s+[A-Za-z0-9\s&]+$/, "")
      .trim();
  }

  const rawDesc = getMeta("og:description") || getMeta("description");
  const cleanDesc = rawDesc
    ? rawDesc
        .replace(/&amp;/g, "&")
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .trim()
    : undefined;

  const siteName = getMeta("og:site_name") || getMeta("author");

  let deadline: string | undefined;
  const deadlineMatch =
    /(?:deadline|closing date|submission deadline)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(
      rawHtml,
    );
  if (deadlineMatch?.[1]) {
    const parsed = new Date(deadlineMatch[1]);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      deadline = `${y}-${m}-${d}`;
    }
  }

  return {
    title: cleanTitle || undefined,
    description: cleanDesc || undefined,
    buyer: siteName || undefined,
    deadline,
  };
}

export type SafeTenderFetchResult = {
  ok: boolean;
  text?: string | undefined;
  title?: string | undefined;
  buyer?: string | undefined;
  description?: string | undefined;
  deadline?: string | undefined;
  contentType?: string | undefined;
  error?: string | undefined;
};

/**
 * Safely fetches remote tender content with SSRF guards, redirect checking,
 * timeouts, modern browser headers, safe fallback, and byte limits.
 */
export async function fetchSafeTenderUrl(
  targetUrl: string,
  maxRedirects = 3,
): Promise<SafeTenderFetchResult> {
  let currentUrl = targetUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const safety = await validateSafeUrl(currentUrl);
    if (!safety.valid || !safety.parsed) {
      return { ok: false, error: safety.reason ?? "URL safety check failed." };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      let response = await fetch(currentUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "manual", // Handle redirects manually to inspect destination IPs
        headers: BROWSER_HEADERS_PRIMARY,
      });

      // Safe fallback on 403/429/503
      if (
        (response.status === 403 || response.status === 429 || response.status === 503) &&
        redirectCount === 0
      ) {
        try {
          const fallbackRes = await fetch(currentUrl, {
            method: "GET",
            signal: controller.signal,
            redirect: "manual",
            headers: BROWSER_HEADERS_FALLBACK,
          });
          if (fallbackRes.ok || (fallbackRes.status >= 300 && fallbackRes.status < 400)) {
            response = fallbackRes;
          }
        } catch {
          // Keep primary response
        }
      }

      clearTimeout(timer);

      // Handle Redirects
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return { ok: false, error: "Redirect response received without Location header." };
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) {
        console.warn(
          `[Intake] Server responded with HTTP ${response.status}: ${response.statusText} for ${currentUrl}`,
        );
        return {
          ok: false,
          error: USER_FACING_URL_ERROR,
        };
      }

      // Check Content-Length header
      const contentLengthHeader = response.headers.get("content-length");
      if (contentLengthHeader && Number(contentLengthHeader) > MAX_FETCH_BYTES) {
        return { ok: false, error: `Remote document exceeds maximum permitted size of 15MB.` };
      }

      const contentType = response.headers.get("content-type") || "text/html";
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_FETCH_BYTES) {
        return { ok: false, error: `Document content exceeds maximum permitted size of 15MB.` };
      }

      const bytes = new Uint8Array(buffer);

      // Determine extraction method based on content type or URL extension
      if (contentType.includes("pdf") || currentUrl.toLowerCase().endsWith(".pdf")) {
        const extracted = await extractDocument("tender.pdf", bytes);
        if (!extracted.ok) {
          return {
            ok: false,
            error: extracted.reason ?? "Failed to extract text from remote PDF.",
          };
        }
        return {
          ok: true,
          text: extracted.text,
          title: "Tender Document (PDF)",
          contentType: "application/pdf",
        };
      }

      // Default to HTML / text
      const rawText = new TextDecoder("utf-8").decode(bytes);
      const metadata = extractHtmlMetadata(rawText);

      const cleanText = htmlToText(rawText);
      if (!cleanText || cleanText.length < 50) {
        return {
          ok: false,
          error: "Insufficient readable tender content extracted from the provided URL.",
        };
      }

      return {
        ok: true,
        text: cleanText,
        title: metadata.title || "Tender Notice",
        buyer: metadata.buyer,
        description: metadata.description,
        deadline: metadata.deadline,
        contentType,
      };
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") {
        return {
          ok: false,
          error: USER_FACING_URL_ERROR,
        };
      }
      return { ok: false, error: USER_FACING_URL_ERROR };
    }
  }

  return { ok: false, error: "Exceeded maximum redirect depth." };
}

/**
 * Ingests a tender from a safe URL, creates opportunity + document, and triggers Phase 2 analysis.
 */
export async function ingestTenderFromUrl(args: {
  supabase: Client;
  userId: string;
  workspaceId: string;
  url: string;
  customTitle?: string | undefined;
  buyer?: string | undefined;
}) {
  const { supabase, userId, workspaceId, url, customTitle, buyer } = args;

  // 0. Enforce server-authoritative billing entitlements
  const { canAnalyzeTender, recordAnalysisUsage } = await import("./billing/entitlements.server");
  const { allowed, reason } = await canAnalyzeTender(supabase, workspaceId);
  if (!allowed) {
    throw new Error(reason || "Tender analysis entitlement exceeded. Please upgrade your plan.");
  }

  // 1. Fetch remote content safely
  const fetchResult = await fetchSafeTenderUrl(url);
  if (!fetchResult.ok || !fetchResult.text) {
    throw new Error(fetchResult.error ?? "Failed to ingest tender from URL.");
  }

  const extractedText = fetchResult.text;
  const title = customTitle?.trim() || fetchResult.title || "Tender Ingested from URL";
  const buyerName = buyer?.trim() || fetchResult.buyer || null;
  const descriptionText = fetchResult.description || extractedText.slice(0, 4000);

  // 2. Insert opportunity
  const { data: opportunity, error: oppErr } = await supabase
    .from("opportunities")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      title,
      buyer: buyerName,
      source_type: "url",
      source_url: url,
      deadline: fetchResult.deadline || null,
      scope: extractedText.slice(0, 4000),
      description: descriptionText,
      status: "analyzing",
      analysis_status: "processing",
      analysis_stage: "EXTRACTION",
    })
    .select()
    .single();

  if (oppErr || !opportunity) {
    throw new Error(`Failed to create opportunity record: ${oppErr?.message}`);
  }

  // 3. Insert opportunity_documents record
  const { error: docErr } = await supabase.from("opportunity_documents").insert({
    workspace_id: workspaceId,
    opportunity_id: opportunity.id,
    file_name: `${title.slice(0, 40)}.txt`,
    mime_type: fetchResult.contentType || "text/plain",
    role: "notice",
    status: "completed",
    extracted_text: extractedText,
    char_count: extractedText.length,
    source_url: url,
  });

  if (docErr) {
    console.error("[Intake] Document record creation error:", docErr.message);
  }

  // 4. Automatically trigger Phase 2 analysis pipeline
  try {
    const analysisResult = await runOpportunityAnalysis({
      supabase,
      userId,
      opportunityId: opportunity.id,
      force: true,
    });

    if (analysisResult && analysisResult.ok) {
      await recordAnalysisUsage(supabase, workspaceId, opportunity.id, userId);
    }

    return {
      opportunityId: opportunity.id,
      analysis: analysisResult,
    };
  } catch (analysisErr) {
    console.error("[Intake] Auto-analysis pipeline error:", analysisErr);
    return {
      opportunityId: opportunity.id,
      analysisError: (analysisErr as Error).message,
    };
  }
}

/**
 * Ingests a tender from an uploaded file already stored in Supabase storage,
 * extracts text, creates opportunity + document, and triggers Phase 2 analysis.
 */
export async function ingestTenderFromUpload(args: {
  supabase: Client;
  userId: string;
  workspaceId: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  customTitle?: string | undefined;
  buyer?: string | undefined;
}) {
  const {
    supabase,
    userId,
    workspaceId,
    storagePath,
    fileName,
    fileSize,
    mimeType,
    customTitle,
    buyer,
  } = args;

  // 0. Enforce server-authoritative billing entitlements
  const { canAnalyzeTender, recordAnalysisUsage } = await import("./billing/entitlements.server");
  const { allowed, reason } = await canAnalyzeTender(supabase, workspaceId);
  if (!allowed) {
    throw new Error(reason || "Tender analysis entitlement exceeded. Please upgrade your plan.");
  }

  // 1. Download file from private documents bucket
  const { data: fileData, error: downloadErr } = await supabase.storage
    .from("documents")
    .download(storagePath);

  if (downloadErr || !fileData) {
    throw new Error(`Could not access uploaded document from storage: ${downloadErr?.message}`);
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());

  // 2. Extract text from file using extractDocument
  const extraction = await extractDocument(fileName, bytes);
  if (!extraction.ok || !extraction.text) {
    throw new Error(
      extraction.reason ?? "Failed to extract readable text from uploaded tender document.",
    );
  }

  const extractedText = extraction.text;
  const title = customTitle?.trim() || fileName.replace(/\.[^/.]+$/, "");

  // 3. Create opportunity record
  const { data: opportunity, error: oppErr } = await supabase
    .from("opportunities")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      title,
      buyer: buyer?.trim() || null,
      source_type: "document",
      scope: extractedText.slice(0, 4000),
      description: extractedText.slice(0, 4000),
      status: "analyzing",
      analysis_status: "processing",
      analysis_stage: "EXTRACTION",
    })
    .select()
    .single();

  if (oppErr || !opportunity) {
    throw new Error(`Failed to create opportunity record: ${oppErr?.message}`);
  }

  // 4. Create opportunity_documents record
  const { error: docErr } = await supabase.from("opportunity_documents").insert({
    workspace_id: workspaceId,
    opportunity_id: opportunity.id,
    file_name: fileName,
    file_size: fileSize,
    mime_type: mimeType,
    storage_path: storagePath,
    role: "tender_spec",
    status: "completed",
    extracted_text: extractedText,
    char_count: extractedText.length,
    page_count: extraction.pageCount ?? null,
  });

  if (docErr) {
    console.error("[Intake] Uploaded document record creation error:", docErr.message);
  }

  // 5. Automatically trigger Phase 2 analysis pipeline
  try {
    const analysisResult = await runOpportunityAnalysis({
      supabase,
      userId,
      opportunityId: opportunity.id,
      force: true,
    });

    if (analysisResult && analysisResult.ok) {
      await recordAnalysisUsage(supabase, workspaceId, opportunity.id, userId);
    }

    return {
      opportunityId: opportunity.id,
      analysis: analysisResult,
    };
  } catch (analysisErr) {
    console.error("[Intake] Auto-analysis pipeline error:", analysisErr);
    return {
      opportunityId: opportunity.id,
      analysisError: (analysisErr as Error).message,
    };
  }
}
