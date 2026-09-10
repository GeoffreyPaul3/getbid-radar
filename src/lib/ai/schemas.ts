/**
 * Structured output contracts for every AI operation.
 * These are validated before anything is persisted or scored.
 */
import { z } from "zod";

export const REQUIREMENT_CATEGORIES = [
  "eligibility",
  "legal_registration",
  "financial",
  "technical",
  "capability",
  "experience",
  "certification",
  "staffing",
  "equipment_resources",
  "geographic",
  "commercial",
  "delivery",
  "timeline",
  "deadline",
  "documentation",
  "compliance",
  "other",
] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const REQUIREMENT_KINDS = [
  "mandatory",
  "scored",
  "informational",
  "deliverable",
  "deadline",
  "qualification",
  "documentation",
] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const IMPORTANCE = ["critical", "high", "medium", "low"] as const;
export const MATCH_VERDICTS = ["match", "partial", "no_match", "unknown"] as const;
export type MatchVerdict = (typeof MATCH_VERDICTS)[number];
export const RISK_LEVELS = ["low", "medium", "high"] as const;

/** Normalise a confidence value: if > 1 it is treated as a percentage (85 → 0.85) */
const normaliseConfidence = z.preprocess((v) => {
  const n = Number(v);
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
}, z.number().min(0).max(1));

export const extractedRequirementSchema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().max(2000).default(""),
  category: z.enum(REQUIREMENT_CATEGORIES),
  kind: z.enum(REQUIREMENT_KINDS),
  is_mandatory: z.boolean(),
  importance: z.enum(IMPORTANCE),
  /** File name of the source document, exactly as supplied. */
  source_document: z.string().max(300).nullable(),
  /** Page number taken from a [[page N]] marker, or null when unavailable. */
  source_page: z.number().int().positive().nullable(),
  source_section: z.string().max(300).nullable(),
  source_quote: z.string().max(1200).nullable(),
  deadline: z.string().max(60).nullable(),
  threshold_value: z.string().max(200).nullable(),
  evidence_needed: z.string().max(600).nullable(),
  is_ambiguous: z.boolean(),
  confidence: normaliseConfidence,
});
export type ExtractedRequirement = z.infer<typeof extractedRequirementSchema>;

export const requirementExtractionSchema = z.object({
  requirements: z.array(extractedRequirementSchema).max(120),
  tender_summary: z.string().max(2000).default(""),
  submission_deadline: z.string().max(60).nullable().default(null),
});
export type RequirementExtraction = z.infer<typeof requirementExtractionSchema>;

export const requirementMatchSchema = z.object({
  requirement_ref: z.string().min(1),
  verdict: z.enum(MATCH_VERDICTS),
  confidence: normaliseConfidence,
  risk: z.enum(RISK_LEVELS),
  reasoning: z.string().max(1200),
  /** Evidence ids taken verbatim from the supplied company evidence list. */
  evidence_ids: z.array(z.string()).max(12).default([]),
  action_required: z.string().max(600).nullable().default(null),
});
export type RequirementMatch = z.infer<typeof requirementMatchSchema>;

export const companyMatchingSchema = z.object({
  matches: z.array(requirementMatchSchema).max(120),
});
export type CompanyMatching = z.infer<typeof companyMatchingSchema>;

/**
 * Qualitative assessment used as INPUT to the deterministic scoring engine.
 * The model never returns a final score or recommendation.
 */
export const assessmentComponentSchema = z.object({
  score: z.number().min(0).max(100),
  confidence: normaliseConfidence,
  rationale: z.string().max(800),
});

export const bidAssessmentSchema = z.object({
  executive_summary: z.string().max(2500),
  components: z.object({
    eligibility: assessmentComponentSchema,
    capability: assessmentComponentSchema,
    experience: assessmentComponentSchema,
    commercial_fit: assessmentComponentSchema,
    resource_fit: assessmentComponentSchema,
    deadline_fit: assessmentComponentSchema,
    risk: assessmentComponentSchema,
  }),
  strengths: z.array(z.string().max(400)).max(12).default([]),
  weaknesses: z.array(z.string().max(400)).max(12).default([]),
  risks: z
    .array(
      z.object({
        title: z.string().max(240),
        severity: z.enum(RISK_LEVELS),
        detail: z.string().max(800).default(""),
      }),
    )
    .max(12)
    .default([]),
  evidence_gaps: z.array(z.string().max(400)).max(12).default([]),
  open_questions: z.array(z.string().max(400)).max(12).default([]),
  required_actions: z.array(z.string().max(400)).max(12).default([]),
  recommended_strategy: z.string().max(1500).default(""),
  estimated_effort_hours_min: z.number().min(0).max(4000).nullable().default(null),
  estimated_effort_hours_max: z.number().min(0).max(4000).nullable().default(null),
});
export type BidAssessment = z.infer<typeof bidAssessmentSchema>;

/* ------------------------------------------------------------------ */
/* JSON schemas handed to the provider (kept close to the Zod schemas) */
/* ------------------------------------------------------------------ */

const nullableString = { type: ["string", "null"] };

export const requirementExtractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["requirements", "tender_summary", "submission_deadline"],
  properties: {
    tender_summary: { type: "string" },
    submission_deadline: nullableString,
    requirements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "description",
          "category",
          "kind",
          "is_mandatory",
          "importance",
          "source_document",
          "source_page",
          "source_section",
          "source_quote",
          "deadline",
          "threshold_value",
          "evidence_needed",
          "is_ambiguous",
          "confidence",
        ],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          category: { type: "string", enum: [...REQUIREMENT_CATEGORIES] },
          kind: { type: "string", enum: [...REQUIREMENT_KINDS] },
          is_mandatory: { type: "boolean" },
          importance: { type: "string", enum: [...IMPORTANCE] },
          source_document: nullableString,
          source_page: { type: ["integer", "null"] },
          source_section: nullableString,
          source_quote: nullableString,
          deadline: nullableString,
          threshold_value: nullableString,
          evidence_needed: nullableString,
          is_ambiguous: { type: "boolean" },
          confidence: { type: "number" },
        },
      },
    },
  },
} as const;

export const companyMatchingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["matches"],
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "requirement_ref",
          "verdict",
          "confidence",
          "risk",
          "reasoning",
          "evidence_ids",
          "action_required",
        ],
        properties: {
          requirement_ref: { type: "string" },
          verdict: { type: "string", enum: [...MATCH_VERDICTS] },
          confidence: { type: "number" },
          risk: { type: "string", enum: [...RISK_LEVELS] },
          reasoning: { type: "string" },
          evidence_ids: { type: "array", items: { type: "string" } },
          action_required: nullableString,
        },
      },
    },
  },
} as const;

const componentJson = {
  type: "object",
  additionalProperties: false,
  required: ["score", "confidence", "rationale"],
  properties: {
    score: { type: "number" },
    confidence: { type: "number" },
    rationale: { type: "string" },
  },
} as const;

export const bidAssessmentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "executive_summary",
    "components",
    "strengths",
    "weaknesses",
    "risks",
    "evidence_gaps",
    "open_questions",
    "required_actions",
    "recommended_strategy",
    "estimated_effort_hours_min",
    "estimated_effort_hours_max",
  ],
  properties: {
    executive_summary: { type: "string" },
    components: {
      type: "object",
      additionalProperties: false,
      required: [
        "eligibility",
        "capability",
        "experience",
        "commercial_fit",
        "resource_fit",
        "deadline_fit",
        "risk",
      ],
      properties: {
        eligibility: componentJson,
        capability: componentJson,
        experience: componentJson,
        commercial_fit: componentJson,
        resource_fit: componentJson,
        deadline_fit: componentJson,
        risk: componentJson,
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    risks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "severity", "detail"],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: [...RISK_LEVELS] },
          detail: { type: "string" },
        },
      },
    },
    evidence_gaps: { type: "array", items: { type: "string" } },
    open_questions: { type: "array", items: { type: "string" } },
    required_actions: { type: "array", items: { type: "string" } },
    recommended_strategy: { type: "string" },
    estimated_effort_hours_min: { type: ["number", "null"] },
    estimated_effort_hours_max: { type: ["number", "null"] },
  },
} as const;
