import { describe, expect, it } from "vitest";
import {
  assertValidModelId,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_QWEN_MODEL,
  FORBIDDEN_MODEL_IDS,
  getProviderModelPool,
  isOperationSupported,
  PROVIDER_CAPABILITIES,
  validateAiConfiguration,
} from "./registry.server";

describe("Provider Registry & Capability Matrix", () => {
  it("establishes Qwen as priority 1 primary provider", () => {
    expect(PROVIDER_CAPABILITIES.qwen.priority).toBe(1);
    expect(PROVIDER_CAPABILITIES.gemini.priority).toBe(2);
    expect(PROVIDER_CAPABILITIES.groq.priority).toBe(3);
    expect(PROVIDER_CAPABILITIES.openrouter.priority).toBe(4);
  });

  it("ensures all providers support required structured operations", () => {
    const requiredOps = [
      "requirement_extraction",
      "requirement_matching",
      "bid_assessment",
    ] as const;

    for (const p of ["qwen", "gemini", "groq", "openrouter"] as const) {
      expect(PROVIDER_CAPABILITIES[p].supportsStructuredOutput).toBe(true);
      for (const op of requiredOps) {
        expect(isOperationSupported(p, op)).toBe(true);
      }
    }
  });

  it("strictly rejects forbidden / decommissioned model IDs", () => {
    expect(FORBIDDEN_MODEL_IDS.has("llama-3.3-70b-versatile")).toBe(true);

    expect(() => assertValidModelId("llama-3.3-70b-versatile")).toThrow(
      /Prohibited model ID/i,
    );
    expect(() => assertValidModelId("LLAMA-3.3-70B-VERSATILE")).toThrow(
      /Prohibited model ID/i,
    );

    // Valid models should not throw
    expect(() => assertValidModelId(DEFAULT_QWEN_MODEL)).not.toThrow();
    expect(() => assertValidModelId(DEFAULT_GEMINI_MODEL)).not.toThrow();
    expect(() => assertValidModelId(DEFAULT_GROQ_MODEL)).not.toThrow();
    expect(() => assertValidModelId(DEFAULT_OPENROUTER_MODEL)).not.toThrow();
  });

  it("filters out forbidden models from provider pools even if requested as override", () => {
    const pool = getProviderModelPool("groq", "llama-3.3-70b-versatile");
    expect(pool).not.toContain("llama-3.3-70b-versatile");
    expect(pool).toContain(DEFAULT_GROQ_MODEL);
  });

  it("returns appropriate default models for each provider", () => {
    expect(DEFAULT_QWEN_MODEL).toBe("qwen-plus");
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.5-flash");
    expect(DEFAULT_GROQ_MODEL).toBe("qwen/qwen3.8-27b");
    expect(DEFAULT_OPENROUTER_MODEL).toBe("nvidia/nemotron-3-super-120b-a12b:free");
  });

  it("validates current environment configuration without throwing", () => {
    const report = validateAiConfiguration();
    expect(report).toBeDefined();
    expect(Array.isArray(report.configuredProviders)).toBe(true);
    expect(Array.isArray(report.missingProviders)).toBe(true);
  });
});
