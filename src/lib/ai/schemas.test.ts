import { describe, expect, it } from "vitest";
import { toGeminiSchema, validateGeminiSchema } from "./gateway.server";
import {
  bidAssessmentJsonSchema,
  bidAssessmentSchema,
  companyMatchingJsonSchema,
  companyMatchingSchema,
  extractedRequirementSchema,
  requirementExtractionJsonSchema,
  requirementExtractionSchema,
  requirementMatchSchema,
} from "./schemas";

const validRequirement = {
  title: "Bidder must hold ISO 9001 certification",
  description: "Certificate must be valid at submission.",
  category: "certification",
  kind: "mandatory",
  is_mandatory: true,
  importance: "critical",
  source_document: "itt.pdf",
  source_page: 12,
  source_section: "3.2",
  source_quote: "The bidder shall hold a valid ISO 9001 certificate.",
  deadline: null,
  threshold_value: null,
  evidence_needed: "Copy of certificate",
  is_ambiguous: false,
  confidence: 0.92,
};

const validAssessmentComponent = { score: 70, confidence: 0.6, rationale: "ok" };
const validAssessment = {
  executive_summary: "summary",
  components: {
    eligibility: validAssessmentComponent,
    capability: validAssessmentComponent,
    experience: validAssessmentComponent,
    commercial_fit: validAssessmentComponent,
    resource_fit: validAssessmentComponent,
    deadline_fit: validAssessmentComponent,
    risk: validAssessmentComponent,
  },
  strengths: [],
  weaknesses: [],
  risks: [],
  evidence_gaps: [],
  open_questions: [],
  required_actions: [],
  recommended_strategy: "",
  estimated_effort_hours_min: null,
  estimated_effort_hours_max: null,
};

describe("requirement extraction schema", () => {
  it("accepts a well-formed requirement", () => {
    expect(extractedRequirementSchema.safeParse(validRequirement).success).toBe(true);
  });

  it("rejects an invalid category enum", () => {
    const parsed = extractedRequirementSchema.safeParse({ ...validRequirement, category: "vibes" });
    expect(parsed.success).toBe(false);
  });

  it("normalises percentage-format confidence and rejects truly invalid values", () => {
    // normaliseConfidence: values > 1 are treated as percentages (85 → 0.85)
    // so 1.4 becomes 0.014 which is valid
    const parsed14 = extractedRequirementSchema.safeParse({ ...validRequirement, confidence: 1.4 });
    expect(parsed14.success).toBe(true);
    if (parsed14.success) {
      expect(parsed14.data.confidence).toBeCloseTo(0.014);
    }
    // 140 (%) → 1.40 which exceeds max(1) after normalisation
    expect(
      extractedRequirementSchema.safeParse({ ...validRequirement, confidence: 140 }).success,
    ).toBe(false);
    // negative values are still rejected
    expect(
      extractedRequirementSchema.safeParse({ ...validRequirement, confidence: -1 }).success,
    ).toBe(false);
  });

  it("rejects a missing required field", () => {
    const { is_mandatory: _drop, ...rest } = validRequirement;
    expect(extractedRequirementSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a non-integer / negative source page", () => {
    expect(
      extractedRequirementSchema.safeParse({ ...validRequirement, source_page: 2.5 }).success,
    ).toBe(false);
    expect(
      extractedRequirementSchema.safeParse({ ...validRequirement, source_page: -3 }).success,
    ).toBe(false);
  });

  it("accepts an extraction envelope and defaults optional fields", () => {
    const parsed = requirementExtractionSchema.safeParse({ requirements: [validRequirement] });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tender_summary).toBe("");
      expect(parsed.data.submission_deadline).toBeNull();
    }
  });
});

describe("matching schema", () => {
  it("accepts the four verdicts and nothing else", () => {
    for (const verdict of ["match", "partial", "no_match", "unknown"]) {
      const parsed = requirementMatchSchema.safeParse({
        requirement_ref: "r1",
        verdict,
        confidence: 0.5,
        risk: "low",
        reasoning: "because",
      });
      expect(parsed.success).toBe(true);
    }
    expect(
      requirementMatchSchema.safeParse({
        requirement_ref: "r1",
        verdict: "definitely_yes",
        confidence: 0.5,
        risk: "low",
        reasoning: "",
      }).success,
    ).toBe(false);
  });

  it("cannot smuggle a score or recommendation into the application", () => {
    const parsed = companyMatchingSchema.parse({
      matches: [
        {
          requirement_ref: "r1",
          verdict: "match",
          confidence: 0.9,
          risk: "low",
          reasoning: "ok",
          bidradar_score: 100,
          recommendation: "bid",
        },
      ],
    });
    expect(parsed.matches[0]).not.toHaveProperty("bidradar_score");
    expect(parsed.matches[0]).not.toHaveProperty("recommendation");
  });
});

describe("assessment schema", () => {
  it("accepts a complete assessment", () => {
    expect(bidAssessmentSchema.safeParse(validAssessment).success).toBe(true);
  });

  it("strips any overall score or recommendation the model tries to add", () => {
    const parsed = bidAssessmentSchema.parse({
      ...validAssessment,
      bidradar_score: 100,
      overall_score: 100,
      recommendation: "bid",
      final_decision: "BID",
    });
    for (const key of ["bidradar_score", "overall_score", "recommendation", "final_decision"]) {
      expect(parsed).not.toHaveProperty(key);
    }
  });

  it("rejects an out-of-range component score", () => {
    expect(
      bidAssessmentSchema.safeParse({
        ...validAssessment,
        components: {
          ...validAssessment.components,
          risk: { score: 250, confidence: 1, rationale: "" },
        },
      }).success,
    ).toBe(false);
  });

  it("rejects a missing component", () => {
    const { risk: _drop, ...components } = validAssessment.components;
    expect(bidAssessmentSchema.safeParse({ ...validAssessment, components }).success).toBe(false);
  });

  it("rejects an invalid risk severity enum", () => {
    expect(
      bidAssessmentSchema.safeParse({
        ...validAssessment,
        risks: [{ title: "t", severity: "apocalyptic", detail: "" }],
      }).success,
    ).toBe(false);
  });
});

describe("Gemini schema converter & protobuf compatibility", () => {
  it("converts requirementExtractionJsonSchema to strict Gemini protobuf format", () => {
    const raw = requirementExtractionJsonSchema as Record<string, unknown>;
    // Before conversion, array types like ["string", "null"] exist and fail protobuf validation
    const preValidation = validateGeminiSchema(raw);
    expect(preValidation.valid).toBe(false);

    const converted = toGeminiSchema(raw) as Record<string, any>;
    const validation = validateGeminiSchema(converted);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Assert converted types
    expect(converted["type"]).toBe("OBJECT");
    const reqItemProps = converted["properties"].requirements.items.properties;
    expect(reqItemProps.title.type).toBe("STRING");
    expect(reqItemProps.is_mandatory.type).toBe("BOOLEAN");
    expect(reqItemProps.source_document.type).toBe("STRING");
    expect(reqItemProps.source_document.nullable).toBe(true);
    expect(Array.isArray(reqItemProps.source_document.type)).toBe(false);
    expect(reqItemProps.source_page.type).toBe("INTEGER");
    expect(reqItemProps.source_page.nullable).toBe(true);
  });

  it("converts companyMatchingJsonSchema to strict Gemini protobuf format", () => {
    const raw = companyMatchingJsonSchema as Record<string, unknown>;
    const converted = toGeminiSchema(raw) as Record<string, any>;
    const validation = validateGeminiSchema(converted);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    const matchProps = converted["properties"].matches.items.properties;
    expect(matchProps.verdict.enum).toBeDefined();
    expect(matchProps.verdict.type).toBe("STRING");
    expect(matchProps.action_required.nullable).toBe(true);
    expect(Array.isArray(matchProps.action_required.type)).toBe(false);
  });

  it("converts bidAssessmentJsonSchema to strict Gemini protobuf format", () => {
    const raw = bidAssessmentJsonSchema as Record<string, unknown>;
    const converted = toGeminiSchema(raw) as Record<string, any>;
    const validation = validateGeminiSchema(converted);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    expect(converted["properties"].estimated_effort_hours_min.nullable).toBe(true);
    expect(converted["properties"].estimated_effort_hours_min.type).toBe("NUMBER");
    expect(Array.isArray(converted["properties"].estimated_effort_hours_min.type)).toBe(false);

    expect(converted["properties"].estimated_effort_hours_max.nullable).toBe(true);
    expect(converted["properties"].estimated_effort_hours_max.type).toBe("NUMBER");
    expect(Array.isArray(converted["properties"].estimated_effort_hours_max.type)).toBe(false);
  });
});
