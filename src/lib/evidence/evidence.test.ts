import { describe, expect, it, vi } from "vitest";
import {
  loadEvidenceBundle,
  rankEvidenceForRequirement,
  relevanceScore,
  retrieveEvidence,
  tokenize,
  type EvidenceItem,
} from "../ai/evidence.server";

describe("tokenize", () => {
  it("converts to lowercase and strips non-alphanumeric characters while preserving slashes and hyphens", () => {
    const tokens = tokenize("ISO/IEC-27001 Certified Security & Compliance!");
    expect(tokens).toContain("iso/iec-27001");
    expect(tokens).toContain("certified");
    expect(tokens).toContain("security");
    expect(tokens).toContain("compliance");
  });

  it("filters out stop words and short tokens", () => {
    const tokens = tokenize("the bidder must provide all required documents for each year");
    expect(tokens).toHaveLength(0);
  });

  it("preserves specialized technical terms and version numbers", () => {
    const tokens = tokenize("Kubernetes v1.28 C++ and Python3 microservices");
    expect(tokens).toContain("kubernetes");
    expect(tokens).toContain("v1.28");
    expect(tokens).toContain("c++");
    expect(tokens).toContain("python3");
    expect(tokens).toContain("microservices");
  });
});

describe("relevanceScore", () => {
  it("returns 1 for exact token overlap", () => {
    const score = relevanceScore(
      "cybersecurity audit compliance",
      "audit compliance cybersecurity",
    );
    expect(score).toBe(1);
  });

  it("returns fractional score for partial token overlap", () => {
    const score = relevanceScore("iso 27001 cybersecurity audit", "certified iso 27001 standard");
    expect(score).toBe(0.5);
  });

  it("returns 0 when there is no token overlap", () => {
    const score = relevanceScore(
      "cloud infrastructure kubernetes",
      "catering service organic food",
    );
    expect(score).toBe(0);
  });

  it("returns 0 for empty query or empty candidate", () => {
    expect(relevanceScore("", "candidate text")).toBe(0);
    expect(relevanceScore("query text", "")).toBe(0);
  });
});

describe("rankEvidenceForRequirement", () => {
  const samplePool: EvidenceItem[] = [
    {
      id: "cert:1",
      origin: "certification",
      sourceId: "c1",
      knowledgeDocumentId: null,
      companyProjectId: null,
      certificationId: "c1",
      label: "ISO 27001 Information Security Management",
      excerpt: "Accredited certification for information security controls and risk assessment.",
      sourceReference: "CERT-2024-001",
      relevance: 0,
      strength: "strong",
    },
    {
      id: "cap:1",
      origin: "capability",
      sourceId: "cap1",
      knowledgeDocumentId: null,
      companyProjectId: null,
      certificationId: null,
      label: "Cloud Security Architecture",
      excerpt: "Expertise in designing secure AWS and Azure environments.",
      sourceReference: null,
      relevance: 0,
      strength: "moderate",
    },
    {
      id: "proj:1",
      origin: "project",
      sourceId: "p1",
      knowledgeDocumentId: null,
      companyProjectId: "p1",
      certificationId: null,
      label: "Hospital Patient Portal Modernization",
      excerpt: "Healthcare web application with HIPAA compliance and encryption.",
      sourceReference: null,
      relevance: 0,
      strength: "moderate",
    },
    {
      id: "profile:1",
      origin: "company_profile",
      sourceId: "prof1",
      knowledgeDocumentId: null,
      companyProjectId: null,
      certificationId: null,
      label: "Acme Cyber Technologies",
      excerpt: "Enterprise security and software engineering provider.",
      sourceReference: null,
      relevance: 0,
      strength: "moderate",
    },
  ];

  it("ranks exact certification match higher than moderate capability match", () => {
    const ranked = rankEvidenceForRequirement(
      samplePool,
      "The contractor must hold ISO 27001 information security certification",
      5,
    );

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]?.id).toBe("cert:1");
    expect(ranked[0]?.relevance).toBeGreaterThan(0.5);
  });

  it("prioritizes stronger evidence origins when token relevance is comparable", () => {
    const pool: EvidenceItem[] = [
      {
        id: "chunk:1",
        origin: "knowledge_chunk",
        sourceId: null,
        knowledgeDocumentId: "d1",
        companyProjectId: null,
        certificationId: null,
        label: "Security handbook excerpt",
        excerpt: "We follow security compliance guidelines across all projects.",
        sourceReference: null,
        relevance: 0,
        strength: "weak",
      },
      {
        id: "cert:2",
        origin: "certification",
        sourceId: "c2",
        knowledgeDocumentId: null,
        companyProjectId: null,
        certificationId: "c2",
        label: "Security Compliance Certification",
        excerpt: "Official security compliance certificate.",
        sourceReference: "CERT-999",
        relevance: 0,
        strength: "strong",
      },
    ];

    const ranked = rankEvidenceForRequirement(pool, "security compliance", 5);
    expect(ranked[0]?.id).toBe("cert:2");
  });

  it("includes fallback company profile when no other evidence matches", () => {
    const ranked = rankEvidenceForRequirement(
      samplePool,
      "quantum cryptography telecommunications",
      5,
    );
    // When no specific match hits, company_profile should be included as baseline context
    expect(ranked.some((r) => r.origin === "company_profile")).toBe(true);
  });

  it("returns empty list if pool is completely empty", () => {
    const ranked = rankEvidenceForRequirement([], "any query", 5);
    expect(ranked).toEqual([]);
  });
});

describe("retrieveEvidence across requirements", () => {
  const pool: EvidenceItem[] = [
    {
      id: "cert:1",
      origin: "certification",
      sourceId: "c1",
      knowledgeDocumentId: null,
      companyProjectId: null,
      certificationId: "c1",
      label: "ISO 9001 Quality Management",
      excerpt: "Certified quality management system.",
      sourceReference: null,
      relevance: 0,
      strength: "strong",
    },
    {
      id: "cap:1",
      origin: "capability",
      sourceId: "cap1",
      knowledgeDocumentId: null,
      companyProjectId: null,
      certificationId: null,
      label: "React and Node.js Development",
      excerpt: "Full-stack web application development.",
      sourceReference: null,
      relevance: 0,
      strength: "strong",
    },
  ];

  it("associates evidence items per requirement and de-duplicates the unique set", () => {
    const reqs = [
      { ref: "req-1", query: "ISO 9001 Quality Assurance" },
      { ref: "req-2", query: "Frontend React TypeScript" },
    ];

    const result = retrieveEvidence(pool, reqs, 3);

    expect(result.byRequirement.has("req-1")).toBe(true);
    expect(result.byRequirement.has("req-2")).toBe(true);

    const r1Items = result.byRequirement.get("req-1")!;
    expect(r1Items.some((i) => i.id === "cert:1")).toBe(true);

    const r2Items = result.byRequirement.get("req-2")!;
    expect(r2Items.some((i) => i.id === "cap:1")).toBe(true);

    expect(result.unique.length).toBeLessThanOrEqual(pool.length);
  });
});

describe("loadEvidenceBundle workspace isolation", () => {
  it("queries only within the requested workspace_id", async () => {
    const targetWorkspace = "ws-isolation-123";
    const queriedTables: string[] = [];

    const mockQueryBuilder = (table: string) => {
      queriedTables.push(table);
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: string) => {
          expect(col).toBe("workspace_id");
          expect(val).toBe(targetWorkspace);
          return builder;
        }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      return builder;
    };

    const mockSupabase: any = {
      from: vi.fn().mockImplementation((table: string) => mockQueryBuilder(table)),
    };

    const bundle = await loadEvidenceBundle(mockSupabase, targetWorkspace);

    expect(bundle.empty).toBe(true);
    expect(bundle.pool).toEqual([]);
    expect(queriedTables).toContain("company_profiles");
    expect(queriedTables).toContain("company_capabilities");
    expect(queriedTables).toContain("company_certifications");
    expect(queriedTables).toContain("company_projects");
    expect(queriedTables).toContain("company_references");
    expect(queriedTables).toContain("team_members");
    expect(queriedTables).toContain("knowledge_chunks");
  });

  it("throws EVIDENCE_RETRIEVAL_FAILED if a query errors", async () => {
    const mockSupabase: any = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: "Database connection failure" } }),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: "Database connection failure" } }),
      })),
    };

    await expect(loadEvidenceBundle(mockSupabase, "ws-fail")).rejects.toThrow(
      "EVIDENCE_RETRIEVAL_FAILED: Database connection failure",
    );
  });
});
