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
export async function fetchSafeTenderUrl(
  targetUrl: string,
  maxRedirects = 3,
): Promise<{ ok: boolean; text?: string; title?: string; contentType?: string; error?: string }> {
  let currentUrl = targetUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const safety = await validateSafeUrl(currentUrl);
    if (!safety.valid || !safety.parsed) {
      return { ok: false, error: safety.reason ?? "URL safety check failed." };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "manual", // Handle redirects manually to inspect destination IPs
        headers: {
          "User-Agent":
            "GetBidRadar/2.0 (Enterprise Tender Verification Engine; +https://getbid-radar.vercel.app)",
          Accept: "text/html,application/xhtml+xml,application/pdf,application/xml,text/plain,*/*",
        },
      });
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
        return {
          ok: false,
          error: `Remote server responded with HTTP ${response.status}: ${response.statusText}`,
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
      // Extract page <title> if present
      const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(rawText);
      const pageTitle = titleMatch ? titleMatch[1]?.trim() : undefined;

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
        title: pageTitle || "Tender Notice",
        contentType,
      };
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") {
        return {
          ok: false,
          error: "Connection timed out while retrieving tender document (12s limit).",
        };
      }
      return { ok: false, error: `Failed to retrieve tender document: ${(err as Error).message}` };
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

  // 1. Fetch remote content safely
  const fetchResult = await fetchSafeTenderUrl(url);
  if (!fetchResult.ok || !fetchResult.text) {
    throw new Error(fetchResult.error ?? "Failed to ingest tender from URL.");
  }

  const title = customTitle?.trim() || fetchResult.title || "Tender Ingested from URL";
  const extractedText = fetchResult.text;

  // 2. Insert opportunity
  const { data: opportunity, error: oppErr } = await supabase
    .from("opportunities")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      title,
      buyer: buyer?.trim() || null,
      source_type: "url",
      source_url: url,
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
