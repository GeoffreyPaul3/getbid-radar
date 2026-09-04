/**
 * Single source of truth for the BidRadar scoring model.
 * Weights and thresholds live here and nowhere else.
 */

export const SCORING_ENGINE_VERSION = "bidradar-scoring-1.0.0";

export const COMPONENT_KEYS = [
  "eligibility",
  "capability",
  "experience",
  "commercial_fit",
  "resource_fit",
  "deadline_fit",
  "risk",
  "evidence_strength",
] as const;
export type ComponentKey = (typeof COMPONENT_KEYS)[number];

export const COMPONENT_WEIGHTS: Record<ComponentKey, number> = {
  eligibility: 0.2,
  capability: 0.15,
  experience: 0.15,
  commercial_fit: 0.1,
  resource_fit: 0.1,
  deadline_fit: 0.1,
  risk: 0.1,
  evidence_strength: 0.1,
};

export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  eligibility: "Eligibility",
  capability: "Capability",
  experience: "Experience",
  commercial_fit: "Commercial fit",
  resource_fit: "Resource fit",
  deadline_fit: "Deadline fit",
  risk: "Risk",
  evidence_strength: "Evidence strength",
};

export const RECOMMENDATION_THRESHOLDS = {
  /** score >= bid AND no confirmed fatal failure */
  bid: 75,
  /** score >= review (and < bid) */
  review: 50,
} as const;
