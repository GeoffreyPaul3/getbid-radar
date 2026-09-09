import { beforeEach, describe, expect, it, vi } from "vitest";
import { runOpportunityAnalysis } from "./pipeline.server";
import { FakeDb, testId } from "../test/fake-supabase";

vi.mock("@/lib/ai/operations.server", async () => {
  const actual = await vi.importActual<any>("@/lib/ai/operations.server");
  return {
    ...actual,
    extractRequirements: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        requirements: [
          {
            title: "Mandatory ISO 27001 Certification",
            description: "Must hold active ISO 27001 certification",
            category: "certification",
            kind: "mandatory",
            is_mandatory: true,
            importance: "critical",
            source_document: "tender.pdf",
            source_page: 1,
            source_section: "1.0",
            source_quote: "Active ISO 27001 required",
            deadline: null,
            threshold_value: null,
            evidence_needed: "ISO 27001 certificate",
            is_ambiguous: false,
            confidence: 0.95,
          },
          {
            title: "5+ Years Cloud Experience",
            description: "Demonstrated 5 years enterprise cloud migration",
            category: "technical",
            kind: "scored",
            is_mandatory: false,
            importance: "high",
            source_document: "tender.pdf",
            source_page: 2,
            source_section: "2.1",
            source_quote: "Minimum 5 years experience",
            deadline: null,
            threshold_value: "5 years",
            evidence_needed: "Case studies and client references",
            is_ambiguous: false,
            confidence: 0.9,
          },
        ],
      },
      usage: {
        activeProvider: "gemini",
        model: "gemini-2.5-flash",
        durationMs: 150,
        attempts: 1,
      },
    }),
    matchRequirements: vi.fn().mockImplementation(async ({ requirements }) => ({
      ok: true,
      data: {
        matches: requirements.map((r: any) => ({
          requirement_ref: r.ref,
          verdict: "match",
          confidence: 0.95,
          reasoning: "Evidence verified against company certifications and past projects.",
          cited_evidence_ids: ["ev-cert-1"],
          gaps: [],
        })),
        coverage_score: 90,
      },
      usage: {
        activeProvider: "gemini",
        model: "gemini-2.5-flash",
        durationMs: 120,
        attempts: 1,
      },
    })),
    assessOpportunity: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        executive_summary: "Strong competitive qualification alignment.",
        strengths: ["ISO 27001 active", "Extensive enterprise track record"],
        weaknesses: [],
        critical_blockers: [],
        required_actions: ["Finalize pricing schedule"],
        evidence_gaps: [],
        open_questions: [],
        recommended_strategy: "Submit high-confidence bid",
        estimated_effort_hours_min: 40,
        estimated_effort_hours_max: 80,
        components: {
          eligibility: { score: 95, confidence: 0.95, blocking: false, rationale: "Eligible" },
          capability: { score: 90, confidence: 0.9, blocking: false, rationale: "Strong" },
          experience: { score: 88, confidence: 0.88, blocking: false, rationale: "Verified" },
          commercial_fit: { score: 80, confidence: 0.8, blocking: false, rationale: "Solid" },
          resource_fit: { score: 85, confidence: 0.85, blocking: false, rationale: "Sufficient" },
          deadline_fit: { score: 90, confidence: 0.9, blocking: false, rationale: "Feasible" },
          risk: { score: 85, confidence: 0.85, blocking: false, rationale: "Low risk" },
        },
      },
      usage: {
        activeProvider: "gemini",
        model: "gemini-2.5-flash",
        durationMs: 200,
        attempts: 1,
      },
    }),
  };
});

describe("Pipeline Persistence & Idempotency Regression Suite", () => {
  const wsId = "ws-test-4000-8000-000000000001";
  const userId = "user-test-4000-8000-000000000001";

  function createSeededDb(oppId: string, title = "Cloud Migration Tender") {
    const db = new FakeDb();
    db.tables["workspaces"] = [{ id: wsId, name: "Test Workspace" }];
    db.tables["opportunities"] = [
      {
        id: oppId,
        workspace_id: wsId,
        title,
        description: "Comprehensive tender specification for enterprise cloud modernization.",
        scope: "Full cloud migration covering database, compute, security, and governance.",
        status: "new",
        analysis_status: "queued",
        analysis_stage: null,
        analysis_error: null,
      },
    ];
    db.tables["opportunity_documents"] = [
      {
        id: testId("doc"),
        workspace_id: wsId,
        opportunity_id: oppId,
        file_name: "tender.pdf",
        role: "tender",
        status: "completed",
        extracted_text:
          "Section 1: Bidders must possess active ISO 27001 certification. Section 2: Minimum 5 years cloud experience.",
        char_count: 500,
        updated_at: new Date().toISOString(),
      },
    ];
    db.tables["company_profiles"] = [
      {
        workspace_id: wsId,
        company_name: "Acme Tech Solutions",
        tagline: "Enterprise cloud & security services",
      },
    ];
    db.tables["company_certifications"] = [
      {
        id: "ev-cert-1",
        workspace_id: wsId,
        name: "ISO 27001",
        status: "active",
        issuing_organization: "BSI",
        expiry_date: "2028-01-01",
      },
    ];
    return db;
  }

  // Test A: first analysis
  it("Test A: first analysis - completes successfully and persists requirements idempotently", async () => {
    const oppId = "opp-test-4000-8000-000000000001";
    const db = createSeededDb(oppId);

    const result = await runOpportunityAnalysis({
      supabase: db.client(),
      opportunityId: oppId,
      userId,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.version).toBe(1);
      expect(result.score).toBeGreaterThan(0);
      expect(["bid", "review", "no_bid"]).toContain(result.recommendation);
    }

    // Verify opportunity state
    const opp = db.rows("opportunities").find((o) => o["id"] === oppId);
    expect(opp?.["status"]).toBe("analyzed");
    expect(opp?.["analysis_status"]).toBe("completed");
    expect(opp?.["analysis_error"]).toBeNull();

    // Verify opportunity_analyses record
    const analyses = db.rows("opportunity_analyses").filter((a) => a["opportunity_id"] === oppId);
    expect(analyses).toHaveLength(1);
    expect(analyses[0]?.["status"]).toBe("completed");
    expect(analyses[0]?.["version"]).toBe(1);

    // Verify opportunity_requirements records persisted
    const requirements = db
      .rows("opportunity_requirements")
      .filter((r) => r["opportunity_id"] === oppId);
    expect(requirements).toHaveLength(2);
    expect(requirements.every((r) => Boolean(r["fingerprint"]))).toBe(true);

    // Verify score_components persisted
    const components = db
      .rows("score_components")
      .filter((c) => c["analysis_id"] === analyses[0]?.["id"]);
    expect(components.length).toBeGreaterThanOrEqual(8);
  });

  // Test B: same analysis retry
  it("Test B: same analysis retry - reuses completed analysis without creating duplicate records", async () => {
    const oppId = "opp-test-4000-8000-000000000002";
    const db = createSeededDb(oppId);

    // Run 1
    const res1 = await runOpportunityAnalysis({
      supabase: db.client(),
      opportunityId: oppId,
      userId,
    });
    expect(res1.ok).toBe(true);

    // Run 2 without force: should detect identical inputs_fingerprint and reuse
    const res2 = await runOpportunityAnalysis({
      supabase: db.client(),
      opportunityId: oppId,
      userId,
    });
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.reused).toBe(true);
      expect(res2.version).toBe(1);
    }

    // Analyses should not be duplicated
    const analyses = db.rows("opportunity_analyses").filter((a) => a["opportunity_id"] === oppId);
    expect(analyses).toHaveLength(1);

    // Requirements should not be duplicated
    const requirements = db
      .rows("opportunity_requirements")
      .filter((r) => r["opportunity_id"] === oppId);
    expect(requirements).toHaveLength(2);
  });

  // Test C: failed persistence recovery
  it("Test C: failed persistence recovery - a failed analysis marks failed state and recovers cleanly on retry", async () => {
    const oppId = "opp-test-4000-8000-000000000003";
    const db = createSeededDb(oppId);

    // Inject temporary failure on opportunity_requirements.upsert
    db.options.failOn = {
      "opportunity_requirements.upsert":
        "there is no unique or exclusion constraint matching the ON CONFLICT specification",
    };

    const failResult = await runOpportunityAnalysis({
      supabase: db.client(),
      opportunityId: oppId,
      userId,
    });

    expect(failResult.ok).toBe(false);
    if (!failResult.ok) {
      expect(failResult.stage).toBe("PERSISTENCE");
      expect(failResult.code).toBe("PERSISTENCE_FAILED");
      expect(failResult.message).toContain("there is no unique or exclusion constraint");
    }

    // Opportunity state must be 'failed' with error recorded (not stuck in 'analyzing')
    let opp = db.rows("opportunities").find((o) => o["id"] === oppId);
    expect(opp?.["analysis_status"]).toBe("failed");
    expect(opp?.["analysis_error"]).toContain("PERSISTENCE_FAILED");

    // Remove the simulated DB error to simulate the migration fix being applied
    delete db.options.failOn["opportunity_requirements.upsert"];

    // Retry the analysis
    const retryResult = await runOpportunityAnalysis({
      supabase: db.client(),
      opportunityId: oppId,
      userId,
      force: true,
    });

    expect(retryResult.ok).toBe(true);
    if (retryResult.ok) {
      expect(retryResult.version).toBe(2);
      expect(retryResult.score).toBeGreaterThan(0);
    }

    // Opportunity state must now be 'completed'
    opp = db.rows("opportunities").find((o) => o["id"] === oppId);
    expect(opp?.["analysis_status"]).toBe("completed");
    expect(opp?.["status"]).toBe("analyzed");
    expect(opp?.["analysis_error"]).toBeNull();

    // The two requirements should be persisted cleanly without duplicates
    const requirements = db
      .rows("opportunity_requirements")
      .filter((r) => r["opportunity_id"] === oppId);
    expect(requirements).toHaveLength(2);
  });

  // Test D: analysis version idempotency
  it("Test D: analysis version idempotency - forced re-run creates next version without duplicating requirements", async () => {
    const oppId = "opp-test-4000-8000-000000000004";
    const db = createSeededDb(oppId);

    // Initial run
    const res1 = await runOpportunityAnalysis({
      supabase: db.client(),
      opportunityId: oppId,
      userId,
    });
    expect(res1.ok).toBe(true);

    // Force re-run (e.g. user clicked "Re-analyze")
    const res2 = await runOpportunityAnalysis({
      supabase: db.client(),
      opportunityId: oppId,
      userId,
      force: true,
    });

    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.version).toBe(2);
    }

    // Both versions exist in history
    const analyses = db.rows("opportunity_analyses").filter((a) => a["opportunity_id"] === oppId);
    expect(analyses).toHaveLength(2);
    expect(analyses.map((a) => a["version"]).sort()).toEqual([1, 2]);

    // Requirements were upserted on (opportunity_id, fingerprint), so exactly 2 requirements exist (no duplicates)
    const requirements = db
      .rows("opportunity_requirements")
      .filter((r) => r["opportunity_id"] === oppId);
    expect(requirements).toHaveLength(2);
    // Updated to version 2
    expect(requirements.every((r) => r["analysis_version"] === 2)).toBe(true);
  });

  // Test E: multiple opportunities
  it("Test E: multiple opportunities - two different opportunities analyze independently without cross-talk", async () => {
    const opp1 = "opp-test-4000-8000-000000000005";
    const opp2 = "opp-test-4000-8000-000000000006";
    const db = createSeededDb(opp1, "Tender A: Cloud Infra");

    // Add second opportunity to the same db
    db.tables["opportunities"]!.push({
      id: opp2,
      workspace_id: wsId,
      title: "Tender B: Cyber Security",
      description: "Tender specification for cybersecurity operations center.",
      scope: "SOC monitoring and incident response.",
      status: "new",
      analysis_status: "queued",
      analysis_stage: null,
      analysis_error: null,
    });
    db.tables["opportunity_documents"]!.push({
      id: testId("doc"),
      workspace_id: wsId,
      opportunity_id: opp2,
      file_name: "tender-b.pdf",
      role: "tender",
      status: "completed",
      extracted_text: "Section 1: SOC 2 compliance. Section 2: 24/7 coverage.",
      char_count: 400,
      updated_at: new Date().toISOString(),
    });

    const res1 = await runOpportunityAnalysis({
      supabase: db.client(),
      opportunityId: opp1,
      userId,
    });
    const res2 = await runOpportunityAnalysis({
      supabase: db.client(),
      opportunityId: opp2,
      userId,
    });

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);

    const reqs1 = db.rows("opportunity_requirements").filter((r) => r["opportunity_id"] === opp1);
    const reqs2 = db.rows("opportunity_requirements").filter((r) => r["opportunity_id"] === opp2);

    expect(reqs1).toHaveLength(2);
    expect(reqs2).toHaveLength(2);
    expect(reqs1.every((r) => r["opportunity_id"] === opp1)).toBe(true);
    expect(reqs2.every((r) => r["opportunity_id"] === opp2)).toBe(true);
  });
});
