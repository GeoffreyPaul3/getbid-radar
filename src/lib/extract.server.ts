/**
 * Document text extraction. Runs server-side only.
 * Supports PDF, DOCX, XLSX, TXT/MD/CSV, HTML and ZIP archives of those.
 * Returns an explicit failure reason instead of guessing when text is not
 * recoverable (e.g. scanned PDFs with no text layer).
 */
import { unzipSync, strFromU8 } from "fflate";

export type ExtractResult = {
  ok: boolean;
  text: string;
  pageCount?: number;
  reason?: string;
};

const MAX_TEXT = 900_000;

function stripXml(xml: string): string {
  return xml
    .replace(/<w:p[ >]/g, "\n<w:p ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1]!.toLowerCase() : "";
}

export const SUPPORTED_EXTENSIONS = [
  "pdf",
  "docx",
  "xlsx",
  "txt",
  "md",
  "csv",
  "html",
  "htm",
  "zip",
];

async function extractPdf(bytes: Uint8Array): Promise<ExtractResult> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(bytes);
    const { text, totalPages } = await extractText(doc, { mergePages: false });
    const pages = Array.isArray(text) ? text : [String(text)];
    const merged = pages
      .map((p, i) => `\n[[page ${i + 1}]]\n${p}`)
      .join("\n")
      .trim();
    const stripped = merged.replace(/\[\[page \d+\]\]/g, "").trim();
    if (stripped.length < 40) {
      return {
        ok: false,
        text: "",
        pageCount: totalPages,
        reason:
          "This PDF has no extractable text layer (it looks scanned). OCR is not configured, so its content could not be read.",
      };
    }
    return { ok: true, text: merged.slice(0, MAX_TEXT), pageCount: totalPages };
  } catch (e) {
    return { ok: false, text: "", reason: `PDF could not be parsed: ${(e as Error).message}` };
  }
}

function extractDocx(bytes: Uint8Array): ExtractResult {
  try {
    const files = unzipSync(bytes);
    const parts = ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml"]
      .filter((p) => files[p])
      .map((p) => stripXml(strFromU8(files[p]!)));
    const text = parts.join("\n\n").trim();
    if (!text) return { ok: false, text: "", reason: "No readable text found in this DOCX file." };
    return { ok: true, text: text.slice(0, MAX_TEXT) };
  } catch (e) {
    return { ok: false, text: "", reason: `DOCX could not be parsed: ${(e as Error).message}` };
  }
}

function extractXlsx(bytes: Uint8Array): ExtractResult {
  try {
    const files = unzipSync(bytes);
    const sharedRaw = files["xl/sharedStrings.xml"];
    const shared: string[] = [];
    if (sharedRaw) {
      const xml = strFromU8(sharedRaw);
      for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
        shared.push(stripXml(m[1]!));
      }
    }
    const lines: string[] = [];
    for (const [name, data] of Object.entries(files)) {
      if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue;
      const xml = strFromU8(data);
      lines.push(`\n[[sheet ${name.replace(/^.*\//, "")}]]`);
      for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
        const cells: string[] = [];
        for (const c of row[1]!.matchAll(/<c[^>]*?(t="(\w+)")?[^>]*>([\s\S]*?)<\/c>/g)) {
          const type = c[2];
          const inner = c[3] ?? "";
          const vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
          if (!vm) {
            const t = stripXml(inner);
            if (t) cells.push(t);
            continue;
          }
          const raw = vm[1]!;
          cells.push(type === "s" ? (shared[Number(raw)] ?? "") : raw);
        }
        if (cells.some((c) => c.trim())) lines.push(cells.join(" | "));
      }
    }
    const text = lines.join("\n").trim();
    if (!text) return { ok: false, text: "", reason: "No readable cells found in this spreadsheet." };
    return { ok: true, text: text.slice(0, MAX_TEXT) };
  } catch (e) {
    return { ok: false, text: "", reason: `XLSX could not be parsed: ${(e as Error).message}` };
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractDocument(
  fileName: string,
  bytes: Uint8Array,
): Promise<ExtractResult> {
  const ext = extensionOf(fileName);
  switch (ext) {
    case "pdf":
      return extractPdf(bytes);
    case "docx":
      return extractDocx(bytes);
    case "xlsx":
      return extractXlsx(bytes);
    case "txt":
    case "md":
    case "csv":
      return { ok: true, text: strFromU8(bytes).slice(0, MAX_TEXT) };
    case "html":
    case "htm":
      return { ok: true, text: htmlToText(strFromU8(bytes)).slice(0, MAX_TEXT) };
    case "zip": {
      try {
        const files = unzipSync(bytes);
        const chunks: string[] = [];
        for (const [name, data] of Object.entries(files)) {
          if (name.endsWith("/")) continue;
          const inner = extensionOf(name);
          if (inner === "zip" || !SUPPORTED_EXTENSIONS.includes(inner)) continue;
          const res = await extractDocument(name, data);
          chunks.push(`\n[[file ${name}]]\n${res.ok ? res.text : `(unreadable: ${res.reason})`}`);
        }
        const text = chunks.join("\n").trim();
        if (!text)
          return { ok: false, text: "", reason: "The archive contained no readable documents." };
        return { ok: true, text: text.slice(0, MAX_TEXT) };
      } catch (e) {
        return { ok: false, text: "", reason: `ZIP could not be opened: ${(e as Error).message}` };
      }
    }
    default:
      return {
        ok: false,
        text: "",
        reason: `Unsupported file type ".${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(", ")}.`,
      };
  }
}

/** Split text into overlapping chunks suitable for targeted AI analysis. */
export function chunkText(text: string, size = 9000, overlap = 400): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + size));
    i += size - overlap;
    if (out.length > 200) break;
  }
  return out;
}
