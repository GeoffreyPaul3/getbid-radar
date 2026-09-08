import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  companySignature,
  inputsFingerprint,
  normalizeRequirement,
  parseDueDate,
  runOpportunityAnalysis,
  verdictToStatus,
} from "./pipeline.server";
import type { ExtractedRequirement } from "../ai/schemas";
import type { CompanyFacts } from "../ai/operations.server";

describe("inputsFingerprint", () => {
  const baseInput = {
    opportunityId: "opp-123",
    documents: [
      { id: "doc-1", updatedAt: "2026-01-01T10:00:00Z", charCount: 5000 },
      { id: "doc-2", updatedAt: "2026-01-02T12:00:00Z", charCount: 8000 },
    ],
    companySignature: "sig-abc-123",
    engineVersion: "v1.0.0",
  };

  it("produces deterministic 64-char sha256 hex string", () => {
    const fp1 = inputsFingerprint(baseInput);
    const fp2 = inputsFingerprint(baseInput);
    expect(fp1).toHaveLength(64);
    expect(fp1).toBe(fp2);
  });

  it("is order-invariant regarding document list ordering", () => {
    const reversed = {
      ...baseInput,
      documents: [baseInput.documents[1]!, baseInput.documents[0]!],
    };
    expect(inputsFingerprint(reversed)).toBe(inputsFingerprint(baseInput));
  });

  it("changes if document updatedAt or charCount changes", () => {
    const changedDoc = {
      ...baseInput,
      documents: [{ ...baseInput.documents[0]!, charCount: 5001 }, baseInput.documents[1]!],
    };
    expect(inputsFingerprint(changedDoc)).not.toBe(inputsFingerprint(baseInput));
  });

  it("changes if company signature changes", () => {
    const changedSig = { ...baseInput, companySignature: "sig-xyz-999" };
    expect(inputsFingerprint(changedSig)).not.toBe(inputsFingerprint(baseInput));
  });

  it("changes if engine version changes", () => {
    const changedVer = { ...baseInput, engineVersion: "v2.0.0" };
    expect(inputsFingerprint(changedVer)).not.toBe(inputsFingerprint(baseInput));
  });
});

describe("companySignature", () => {
  const baseCompany: CompanyFacts = {
    profile: {
      name: "Acme Cloud Ltd",
      tagline:
        "Leading cloud engineering firm specializing in AWS, Azure and ISO 27001 compliance.",
    },
    capabilities: [{ kind: "core", name: "Cloud migration", description: "AWS & Azure" }],
    certifications: [
      {
        name: "ISO 27001",
        kind: "security",
        status: "active",
        issuing_organization: "BSI",
        expiry_date: "2027-01-01",
      },
    ],
    projects: [
      {
        name: "Project Orion",
        client: "FinCorp",
        industry: "Finance",
        location: "London",
        contract_value: 500000,
        currency: "GBP",
        start_date: "2024-01-01",
        end_date: "2024-12-31",
        scope: "Cloud infrastructure migration",
        services_delivered: ["AWS CloudFormation"],
        capabilities: ["Cloud migration"],
      },
    ],
    team: [
      {
        name: "Dr. Jane Smith",
        role: "Lead Architect",
        years_experience: 12,
        skills: ["AWS", "Kubernetes"],
        certifications: ["AWS Solutions Architect"],
      },
    ],
    referenceCount: 3,
  };

  it("produces a 32-char hex signature", () => {
    const sig = companySignature(baseCompany);
    expect(sig).toHaveLength(32);
  });

  it("changes if profile or certifications change", () => {
    const sig1 = companySignature(baseCompany);
    const sig2 = companySignature({
      ...baseCompany,
      certifications: [
        {
          name: "SOC 2 Type II",
          kind: "security",
          status: "active",
          issuing_organization: "AICPA",
          expiry_date: "2027-01-01",
        },
      ],
    });
    expect(sig1).not.toBe(sig2);
  });
});

describe("verdictToStatus", () => {
  it("maps match to pass", () => {
    expect(verdictToStatus("match", 2)).toBe("pass");
  });

  it("maps partial to partial", () => {
    expect(verdictToStatus("partial", 1)).toBe("partial");
  });

  it("maps no_match to fail", () => {
    expect(verdictToStatus("no_match", 1)).toBe("fail");
  });

  it("maps unknown to missing when evidenceCount is 0", () => {
    expect(verdictToStatus("unknown", 0)).toBe("missing");
  });

  it("maps unknown to needs_review when evidenceCount > 0", () => {
    expect(verdictToStatus("unknown", 2)).toBe("needs_review");
  });
});

describe("parseDueDate", () => {
  it("parses valid YYYY-MM-DD", () => {
    expect(parseDueDate("2026-06-15")).toBe("2026-06-15");
  });

  it("extracts date from ISO string", () => {
    expect(parseDueDate("2026-11-20T17:00:00.000Z")).toBe("2026-11-20");
  });

  it("returns null for invalid date string", () => {
    expect(parseDueDate("not-a-date")).toBeNull();
  });

  it("returns null for null or undefined", () => {
    expect(parseDueDate(null)).toBeNull();
  });
});

describe("normalizeRequirement", () => {
  it("normalizes extracted requirement into database fields", () => {
    const raw: ExtractedRequirement = {
      title: "Mandatory ISO 27001 Certification",
      description: "The vendor must provide a valid ISO 27001 certificate at bid submission.",
      category: "certification",
      kind: "mandatory",
      is_mandatory: true,
      importance: "critical",
      source_document: "tender.pdf",
      source_page: 12,
      source_section: "4.1.2",
      source_quote: "Attach ISO certificate to appendix",
      deadline: null,
      threshold_value: null,
      evidence_needed: "Valid ISO 27001 certificate",
      is_ambiguous: false,
      confidence: 0.95,
    };

    const normalized = normalizeRequirement(raw, 2);

    expect(normalized.requirement).toBe(raw.title);
    expect(normalized.req_type).toBe("certification");
    expect(normalized.category).toBe("certification");
    expect(normalized.is_mandatory).toBe(true);
    expect(normalized.importance).toBe("critical");
    expect(normalized.analysis_version).toBe(2);
    expect(normalized.fingerprint).toBeDefined();
    expect(normalized.source_reference).toBe("Attach ISO certificate to appendix");
  });
});

describe("runOpportunityAnalysis error handling & orchestration", () => {
  it("returns NOT_FOUND when opportunity row is missing", async () => {
    const mockSupabase: any = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    };

    const result = await runOpportunityAnalysis({
      supabase: mockSupabase,
      opportunityId: "opp-missing-999",
      userId: "user-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("PERSISTENCE");
      expect(result.code).toBe("NOT_FOUND");
    }
  });

  it("returns DOCUMENT_LOAD_FAILED when documents query fails", async () => {
    const mockSupabase: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "opportunities") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "opp-1",
                workspace_id: "ws-1",
                title: "Test Tender",
                description: "Test Description",
                deadline: null,
                status: "draft",
              },
              error: null,
            }),
          };
        }
        if (table === "opportunity_documents") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: null,
                error: { message: "Storage network error" },
              }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };

    const result = await runOpportunityAnalysis({
      supabase: mockSupabase,
      opportunityId: "opp-1",
      userId: "user-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("EXTRACTION");
      expect(result.code).toBe("DOCUMENT_LOAD_FAILED");
      expect(result.message).toContain("Storage network error");
    }
  });

  it("returns EXTRACTION_FAILED when tender has no text documents and description is too short", async () => {
    const mockSupabase: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "opportunities") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "opp-short",
                workspace_id: "ws-1",
                title: "Short Tender",
                description: "Too short description.",
                deadline: null,
                status: "draft",
              },
              error: null,
            }),
          };
        }
        if (table === "opportunity_documents") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: [], error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };

    const result = await runOpportunityAnalysis({
      supabase: mockSupabase,
      opportunityId: "opp-short",
      userId: "user-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("EXTRACTION");
      expect(result.code).toBe("EXTRACTION_FAILED");
      expect(result.message).toContain("No extracted tender text is available");
    }
  });
});
