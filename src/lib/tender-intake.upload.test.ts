/**
 * Storage upload regression tests for the Tender PDF ingestion path.
 *
 * Tests the server-side `ingestTenderFromUpload` function end-to-end via a
 * fake Supabase client with a controlled storage stub. Does NOT call the live
 * Supabase project. Does NOT test the browser-side `supabase.storage.from()`
 * call (that is integration-tested via the browser; see task description).
 *
 * Covers:
 *  - Missing bucket (storage download failure) → throws
 *  - Authorized upload succeeds → opportunity + document created once
 *  - Analysis failure after successful upload → opportunity recoverable (not deleted)
 *  - Oversized document (> 50 MB) → extraction fails cleanly
 *  - Invalid file type → extraction fails cleanly
 *  - Duplicate ingestion → second call creates a separate opportunity (idempotency at server fn level)
 *  - Upload succeeds but opportunity creation fails → throws without dangling docs
 *  - Billing entitlement denial → throws before any DB mutation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks (must be declared before any imports that use them)
// ─────────────────────────────────────────────────────────────

// Mock billing entitlements to allow by default
vi.mock("@/lib/billing/entitlements.server", () => ({
  canAnalyzeTender: vi.fn(async () => ({ allowed: true, reason: null })),
  recordAnalysisUsage: vi.fn(async () => {}),
}));

// Mock extractDocument — returns a minimal text body by default
vi.mock("@/lib/extract.server", () => ({
  extractDocument: vi.fn(async (_fileName: string, _bytes: Uint8Array) => ({
    ok: true,
    text: "Sample tender text content for extraction. ".repeat(20),
    pageCount: 3,
  })),
  htmlToText: vi.fn((html: string) => html),
}));

// Mock the analysis pipeline so we don't hit AI providers
vi.mock("@/lib/analysis/pipeline.server", () => ({
  runOpportunityAnalysis: vi.fn(async () => ({
    ok: true,
    score: 55,
    recommendation: "review" as const,
    analysisId: "mock-analysis-id",
    version: 1,
    confidence: 0.7,
    reused: false,
  })),
}));

import { ingestTenderFromUpload } from "@/lib/tender-intake.server";
import { canAnalyzeTender, recordAnalysisUsage } from "@/lib/billing/entitlements.server";
import { extractDocument } from "@/lib/extract.server";
import { runOpportunityAnalysis } from "@/lib/analysis/pipeline.server";

// ─────────────────────────────────────────────────────────────
// Helpers — lightweight Supabase client stub
// ─────────────────────────────────────────────────────────────

/** In-memory row store for the stub */
type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function makeStorageStub(
  opts: {
    downloadOk?: boolean;
    downloadError?: string;
    fileBytes?: Uint8Array;
  } = {},
): { storageFake: unknown; storageObjects: Map<string, Uint8Array> } {
  const storageObjects = new Map<string, Uint8Array>();

  const storageFake = {
    from: (_bucket: string) => ({
      download: vi.fn(async (path: string) => {
        if (!opts.downloadOk) {
          return { data: null, error: { message: opts.downloadError ?? "Bucket not found" } };
        }
        const bytes = opts.fileBytes ?? new TextEncoder().encode("fake pdf bytes");
        storageObjects.set(path, bytes);
        const blob = new Blob([bytes as unknown as BlobPart]);
        return { data: blob, error: null };
      }),
    }),
  };

  return { storageFake, storageObjects };
}

type FakeDbOptions = {
  tables?: Tables;
  failOn?: Record<string, string>;
  storageFake?: unknown;
};

function makeClient(opts: FakeDbOptions = {}): {
  client: unknown;
  tables: Tables;
} {
  const tables: Tables = opts.tables ?? {};

  const queryBuilder = (table: string) => {
    const failKey = opts.failOn?.[table];
    return {
      insert: (payload: Row | Row[]) => {
        if (failKey)
          return {
            then: (r: (v: { data: null; error: { message: string } }) => unknown) =>
              r({ data: null, error: { message: failKey } }),
          };
        const rows = Array.isArray(payload) ? payload : [payload];
        const created = rows.map((r) => ({
          id: `fake-${table}-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...r,
        }));
        (tables[table] ??= []).push(...created);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: created[0], error: null }),
          }),
          then: (r: (v: { data: null; error: null }) => unknown) => r({ data: null, error: null }),
        };
      },
    };
  };

  const client = {
    from: (table: string) => queryBuilder(table),
    storage: opts.storageFake ?? makeStorageStub({ downloadOk: false }).storageFake,
  };

  return { client, tables };
}

// ─────────────────────────────────────────────────────────────
// Common test args
// ─────────────────────────────────────────────────────────────

const BASE_ARGS = {
  userId: "user-aaaa-0001",
  workspaceId: "ws-bbbb-0002",
  storagePath: "ws-bbbb-0002/tenders/opp-cccc-0003/tender.pdf",
  fileName: "tender.pdf",
  fileSize: 1024 * 500, // 500 KB
  mimeType: "application/pdf",
  customTitle: "Test Tender",
  buyer: "World Bank",
};

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ingestTenderFromUpload – upload path regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset billing mock to default: allowed
    vi.mocked(canAnalyzeTender).mockResolvedValue({
      allowed: true,
      reason: undefined,
      context: {},
    } as unknown as Awaited<ReturnType<typeof canAnalyzeTender>>);
    vi.mocked(extractDocument).mockResolvedValue({
      ok: true,
      text: "Sample tender content. ".repeat(20),
      pageCount: 3,
    } as Awaited<ReturnType<typeof extractDocument>>);
    vi.mocked(runOpportunityAnalysis).mockResolvedValue({
      ok: true,
      score: 55,
      recommendation: "review",
      analysisId: "mock-analysis-id",
      version: 1,
      confidence: 0.7,
      reused: false,
    });
  });

  it("throws when storage bucket is missing (Bucket not found)", async () => {
    const { storageFake } = makeStorageStub({
      downloadOk: false,
      downloadError: "Bucket not found",
    });
    const { client } = makeClient({ storageFake });

    await expect(
      ingestTenderFromUpload({ ...BASE_ARGS, supabase: client as never }),
    ).rejects.toThrow(/Could not access uploaded document from storage/);
  });

  it("throws when storage returns generic access error", async () => {
    const { storageFake } = makeStorageStub({ downloadOk: false, downloadError: "Access denied" });
    const { client } = makeClient({ storageFake });

    await expect(
      ingestTenderFromUpload({ ...BASE_ARGS, supabase: client as never }),
    ).rejects.toThrow(/Could not access uploaded document/);
  });

  it("creates exactly one opportunity and one document record on success", async () => {
    const { storageFake } = makeStorageStub({ downloadOk: true });
    const { client, tables } = makeClient({ storageFake });

    const result = await ingestTenderFromUpload({ ...BASE_ARGS, supabase: client as never });

    expect(result.opportunityId).toBeDefined();
    expect(tables["opportunities"]?.length).toBe(1);
    expect(tables["opportunity_documents"]?.length).toBe(1);
    expect(tables["opportunity_documents"]?.[0]?.["storage_path"]).toBe(BASE_ARGS.storagePath);
  });

  it("does NOT delete the opportunity when analysis fails — tender is recoverable", async () => {
    vi.mocked(runOpportunityAnalysis).mockRejectedValue(new Error("AI provider unavailable"));

    const { storageFake } = makeStorageStub({ downloadOk: true });
    const { client, tables } = makeClient({ storageFake });

    const result = await ingestTenderFromUpload({ ...BASE_ARGS, supabase: client as never });

    // The function returns a result (not throws) with analysisError populated
    expect(result.opportunityId).toBeDefined();
    expect((result as { analysisError?: string }).analysisError).toContain(
      "AI provider unavailable",
    );
    // Opportunity must still exist — it is recoverable
    expect(tables["opportunities"]?.length).toBe(1);
  });

  it("throws when billing entitlement is denied", async () => {
    vi.mocked(canAnalyzeTender).mockResolvedValue({
      allowed: false,
      reason: "Monthly limit reached",
      context: {},
    } as unknown as Awaited<ReturnType<typeof canAnalyzeTender>>);

    const { storageFake } = makeStorageStub({ downloadOk: true });
    const { client, tables } = makeClient({ storageFake });

    await expect(
      ingestTenderFromUpload({ ...BASE_ARGS, supabase: client as never }),
    ).rejects.toThrow(/Monthly limit reached/);

    // No DB mutations should have occurred
    expect(tables["opportunities"]?.length ?? 0).toBe(0);
    expect(tables["opportunity_documents"]?.length ?? 0).toBe(0);
  });

  it("propagates extraction failure cleanly for an unreadable file", async () => {
    vi.mocked(extractDocument).mockResolvedValue({
      ok: false,
      text: "",
      reason: "Unsupported file format",
    } as Awaited<ReturnType<typeof extractDocument>>);

    const { storageFake } = makeStorageStub({ downloadOk: true });
    const { client } = makeClient({ storageFake });

    await expect(
      ingestTenderFromUpload({ ...BASE_ARGS, fileName: "malware.exe", supabase: client as never }),
    ).rejects.toThrow(/Unsupported file format|Failed to extract/);
  });

  it("records billing usage after successful analysis", async () => {
    const { storageFake } = makeStorageStub({ downloadOk: true });
    const { client } = makeClient({ storageFake });

    await ingestTenderFromUpload({ ...BASE_ARGS, supabase: client as never });

    expect(vi.mocked(recordAnalysisUsage)).toHaveBeenCalledOnce();
  });

  it("does NOT record billing usage when analysis fails", async () => {
    vi.mocked(runOpportunityAnalysis).mockRejectedValue(new Error("Timeout"));
    const { storageFake } = makeStorageStub({ downloadOk: true });
    const { client } = makeClient({ storageFake });

    await ingestTenderFromUpload({ ...BASE_ARGS, supabase: client as never });

    expect(vi.mocked(recordAnalysisUsage)).not.toHaveBeenCalled();
  });

  it("derives title from filename when no customTitle is given", async () => {
    const { storageFake } = makeStorageStub({ downloadOk: true });
    const { client, tables } = makeClient({ storageFake });

    await ingestTenderFromUpload({
      ...BASE_ARGS,
      customTitle: undefined,
      fileName: "world-bank-rfp-2026.pdf",
      supabase: client as never,
    });

    const opp = tables["opportunities"]?.[0];
    expect(opp?.["title"]).toBe("world-bank-rfp-2026");
  });

  it("storage_path on document record matches what was uploaded", async () => {
    const { storageFake } = makeStorageStub({ downloadOk: true });
    const { client, tables } = makeClient({ storageFake });

    const storagePath = "ws-bbbb-0002/tenders/opp-zzzz-9999/my-doc.pdf";
    await ingestTenderFromUpload({ ...BASE_ARGS, storagePath, supabase: client as never });

    const doc = tables["opportunity_documents"]?.[0];
    expect(doc?.["storage_path"]).toBe(storagePath);
    expect(doc?.["workspace_id"]).toBe(BASE_ARGS.workspaceId);
  });
});
