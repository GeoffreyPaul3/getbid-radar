/**
 * End-to-end integration tests for real tender URLs:
 * A: Youth Growth Portal (World Bank Small AI Hackathon Challenge 2026)
 * B: UNGM (Notice 313114)
 *
 * Verifies:
 * - URL fetch & extraction
 * - Requirement extraction via Qwen Primary
 * - Evidence retrieval & matching with corrected evidence semantics
 * - Qualitative assessment
 * - Deterministic scoring & recommendation (BID / REVIEW / NO-BID)
 * - Absence of obsolete model errors (e.g. llama-3.3-70b-versatile)
 */
import { describe, expect, it } from "vitest";
import { ensureServerEnv } from "../server-env";
import { fetchSafeTenderUrl } from "../tender-intake.server";
import { runOpportunityAnalysis } from "../analysis/pipeline.server";
import { FakeDb, testId } from "../test/fake-supabase";

ensureServerEnv();

const hasAiKey = Boolean(
  (process.env["DASHSCOPE_API_KEY"] && process.env["DASHSCOPE_API_KEY"].length > 5) ||
    (process.env["GEMINI_API_KEY"] && process.env["GEMINI_API_KEY"].length > 5),
);

describe.runIf(hasAiKey)("Real Tender URLs Live End-to-End Analysis", () => {
  const wsId = testId("ws");
  const userId = testId("usr");

  function createTenderDb(oppId: string, title: string, text: string, deadline?: string | null) {
    const db = new FakeDb();

    db.tables["workspaces"] = [{ id: wsId, name: "Nuerex Labs Workspace", created_by: userId }];
    db.tables["workspace_members"] = [{ workspace_id: wsId, user_id: userId, role: "owner" }];
    db.tables["opportunities"] = [
      {
        id: oppId,
        workspace_id: wsId,
        title,
        description: `Tender opportunity: ${title}`,
        scope: "Global submission",
        deadline: deadline ?? null,
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
        file_name: "tender-notice.html",
        role: "tender",
        status: "completed",
        extracted_text: text,
        char_count: text.length,
        updated_at: new Date().toISOString(),
      },
    ];
    // Company Profile: Nuerex Labs in Lilongwe, Malawi
    db.tables["company_profiles"] = [
      {
        workspace_id: wsId,
        company_name: "Nuerex Labs",
        legal_name: "Nuerex Labs Limited",
        country: "Malawi",
        tagline: "Artificial intelligence, software innovation, and data solutions",
        description: "AI software and machine learning engineering laboratory based in Lilongwe, Malawi.",
      },
    ];
    db.tables["company_capabilities"] = [
      {
        id: testId("cap"),
        workspace_id: wsId,
        kind: "service",
        name: "Artificial Intelligence & Software Engineering",
        description: "Development of AI models, full-stack web applications, and data pipelines.",
      },
    ];
    db.tables["company_certifications"] = [
      {
        id: testId("cert"),
        workspace_id: wsId,
        name: "Business Registration Certificate",
        status: "active",
        issuing_organization: "Malawi Registrar General",
        expiry_date: "2030-01-01",
      },
    ];

    return db;
  }

  it("completes full qualification pipeline for Youth Growth Portal with corrected evidence semantics", async () => {
    const urlA =
      "https://youthgrowthportal.org/opportunity/world-bank-small-ai-hackathon-2026-seoul";

    console.log("[E2E] Fetching Youth Growth Portal URL...");
    const intakeResult = await fetchSafeTenderUrl(urlA);
    expect(intakeResult.ok).toBe(true);
    expect(intakeResult.text).toBeDefined();
    expect(intakeResult.text!.length).toBeGreaterThan(300);

    const oppId = testId("opp-ygp");
    const db = createTenderDb(
      oppId,
      intakeResult.title || "World Bank Small AI Hackathon Challenge 2026",
      intakeResult.text!,
      intakeResult.deadline,
    );

    console.log("[E2E] Running full opportunity analysis via Primary AI Gateway...");
    const result = await runOpportunityAnalysis({
      supabase: db.client(),
      opportunityId: oppId,
      userId,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(["bid", "review", "no_bid"]).toContain(result.recommendation);
      expect(result.version).toBe(1);

      // Verify opportunity record was updated to completed
      const opp = db.rows("opportunities").find((o) => o["id"] === oppId);
      expect(opp?.["analysis_status"]).toBe("completed");

      // Verify analysis record was created
      const analysis = db.rows("opportunity_analyses").find((a) => a["opportunity_id"] === oppId);
      expect(analysis).toBeDefined();
      expect(analysis?.["status"]).toBe("completed");
      expect(analysis?.["recommendation"]).toBe(result.recommendation);
      expect(Array.isArray(analysis?.["risks"])).toBe(true);

      // Verify requirement extraction
      const reqs = db.rows("opportunity_requirements").filter((r) => r["opportunity_id"] === oppId);
      expect(reqs.length).toBeGreaterThanOrEqual(1);

      // Verify Evidence Semantics:
      // Search for any citizenship or residency requirement
      const residencyReq = reqs.find((r) => {
        const text = `${r["title"]} ${r["description"]}`.toLowerCase();
        return text.includes("residenc") || text.includes("citizen") || text.includes("member country");
      });

      if (residencyReq) {
        // Find matching score / match record for this requirement
        // The company is in Malawi, but no individual passports were provided.
        // It should NOT be a confirmed match!
        const matchVerdict = residencyReq["status"] || residencyReq["match_verdict"];
        if (matchVerdict) {
          expect(matchVerdict).not.toBe("match");
        }
      }

      console.log(
        `[E2E] Youth Growth Portal Analysis Complete! Score=${result.score}, Rec=${result.recommendation}, Reqs=${reqs.length}`,
      );
    }
  }, 240_000);

  it("completes full qualification pipeline for UNGM Notice 313114 without obsolete model errors", async () => {
    const urlB = "https://www.ungm.org/Public/Notice/313114";

    console.log("[E2E] Fetching UNGM Notice URL...");
    const intakeResult = await fetchSafeTenderUrl(urlB);
    expect(intakeResult.ok).toBe(true);
    expect(intakeResult.text).toBeDefined();
    expect(intakeResult.text!.length).toBeGreaterThan(100);

    const oppId = testId("opp-ungm");
    const db = createTenderDb(
      oppId,
      intakeResult.title || "UNGM Procurement Notice 313114",
      intakeResult.text!,
      intakeResult.deadline,
    );

    console.log("[E2E] Running UNGM analysis via Primary AI Gateway...");
    const result = await runOpportunityAnalysis({
      supabase: db.client(),
      opportunityId: oppId,
      userId,
    });

    if (!result.ok) {
      console.error("[E2E] UNGM analysis failed with result:", JSON.stringify(result, null, 2));
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(["bid", "review", "no_bid"]).toContain(result.recommendation);

      const opp = db.rows("opportunities").find((o) => o["id"] === oppId);
      expect(opp?.["analysis_status"]).toBe("completed");

      const reqs = db.rows("opportunity_requirements").filter((r) => r["opportunity_id"] === oppId);
      expect(reqs.length).toBeGreaterThanOrEqual(1);

      console.log(
        `[E2E] UNGM Notice 313114 Analysis Complete! Score=${result.score}, Rec=${result.recommendation}, Reqs=${reqs.length}`,
      );
    }
  }, 240_000);
});
