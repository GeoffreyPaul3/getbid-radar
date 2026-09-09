/**
 * Live integration test verifying structured output schemas against the live Google Gemini API.
 * Gated by GEMINI_API_KEY environment variable — safely skips if the key is not present.
 * Never logs or asserts the raw API key.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureServerEnv } from "../server-env";
import { callStructuredAi } from "./gateway.server";
import {
  bidAssessmentJsonSchema,
  bidAssessmentSchema,
  companyMatchingJsonSchema,
  companyMatchingSchema,
  requirementExtractionJsonSchema,
  requirementExtractionSchema,
} from "./schemas";

ensureServerEnv();

const hasGeminiKey = Boolean(
  process.env["GEMINI_API_KEY"] && process.env["GEMINI_API_KEY"].length > 5,
);

describe.runIf(hasGeminiKey)("Live Google Gemini API structured output verification", () => {
  let savedDashscopeKey: string | undefined;

  beforeEach(() => {
    savedDashscopeKey = process.env["DASHSCOPE_API_KEY"];
    delete process.env["DASHSCOPE_API_KEY"];
  });

  afterEach(() => {
    if (savedDashscopeKey !== undefined) {
      process.env["DASHSCOPE_API_KEY"] = savedDashscopeKey;
    }
  });
  it("extracts requirements from live tender sample text using requirementExtractionSchema", async () => {
    const result = await callStructuredAi({
      system:
        "You are an expert tender intake specialist. Extract explicit compliance and qualification requirements.",
      user:
        "Tender: Municipal Cybersecurity Framework\n" +
        "Section 1: The bidder must hold active ISO 27001 certification at submission time.\n" +
        "Section 2: Team lead must have at least 5 years of public sector incident response experience.\n" +
        "Deadline for submission is 2026-12-01 17:00 UTC.",
      toolName: "extract_requirements",
      toolDescription: "Extracts structured requirements from tender text",
      jsonSchema: requirementExtractionJsonSchema,
      schema: requirementExtractionSchema,
      timeoutMs: 30_000,
      maxAttempts: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usage.activeProvider).toBe("gemini");
      expect(Array.isArray(result.data.requirements)).toBe(true);
      expect(result.data.requirements.length).toBeGreaterThanOrEqual(1);
      const firstReq = result.data.requirements[0]!;
      expect(typeof firstReq.title).toBe("string");
      expect(typeof firstReq.is_mandatory).toBe("boolean");
    }
  }, 40_000);

  it("matches company profile against requirements using companyMatchingSchema", async () => {
    const result = await callStructuredAi({
      system:
        "You are a qualification specialist evaluating company capabilities against tender requirements.",
      user:
        "Requirement ref: req-1: Must have ISO 27001 certification.\n" +
        "Company evidence: [ev-1] Active ISO 27001 certificate valid through 2028.\n\n" +
        "Assess match status.",
      toolName: "match_company_profile",
      toolDescription: "Matches company capabilities to requirements",
      jsonSchema: companyMatchingJsonSchema,
      schema: companyMatchingSchema,
      timeoutMs: 30_000,
      maxAttempts: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usage.activeProvider).toBe("gemini");
      expect(Array.isArray(result.data.matches)).toBe(true);
      expect(result.data.matches.length).toBeGreaterThanOrEqual(1);
      const match = result.data.matches[0]!;
      expect(["match", "partial", "no_match", "unknown"]).toContain(match.verdict);
      expect(typeof match.reasoning).toBe("string");
    }
  }, 40_000);

  it("produces qualitative assessment components using bidAssessmentSchema", async () => {
    const result = await callStructuredAi({
      system:
        "You are a tender assessment specialist. Provide qualitative scoring component inputs.",
      user:
        "Tender: Cloud Infrastructure Migration.\n" +
        "Company profile: Mid-size cloud specialist with 10 years AWS/Azure experience.\n" +
        "Provide qualitative fit evaluation.",
      toolName: "qualitative_assessment",
      toolDescription: "Evaluates qualitative bid components",
      jsonSchema: bidAssessmentJsonSchema,
      schema: bidAssessmentSchema,
      timeoutMs: 30_000,
      maxAttempts: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usage.activeProvider).toBe("gemini");
      expect(typeof result.data.executive_summary).toBe("string");
      expect(result.data.components).toBeDefined();
      expect(result.data.components.eligibility.score).toBeGreaterThanOrEqual(0);
      expect(result.data.components.eligibility.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.data.strengths)).toBe(true);
    }
  }, 40_000);
});
