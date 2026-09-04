/**
 * Deterministic BidRadar scoring engine.
 *
 * Pure functions only: the same inputs always produce the same score,
 * recommendation and confidence. The LLM never produces the final score.
 */
import {
  COMPONENT_KEYS,
  COMPONENT_LABELS,
  COMPONENT_WEIGHTS,
  RECOMMENDATION_THRESHOLDS,
  SCORING_ENGINE_VERSION,
  type ComponentKey,
} from "./weights";

export type MatchVerdict = "match" | "partial" | "no_match" | "unknown";
export type Recommendation = "bid" | "review" | "no_bid";
export type FailureKind = "confirmed" | "possible" | "unknown";

export type ScoredRequirement = {
  id: string;
  title: string;
  isMandatory: boolean;
  importance: "critical" | "high" | "medium" | "low";
  verdict: MatchVerdict;
  /** 0..1 confidence in the verdict */
  confidence: number;
  evidenceCount: number;
};

export type AssessmentInput = {
  eligibility: { score: number; confidence: number; rationale: string };
  capability: { score: number; confidence: number; rationale: string };
  experience: { score: number; confidence: number; rationale: string };
  commercial_fit: { score: number; confidence: number; rationale: string };
  resource_fit: { score: number; confidence: number; rationale: string };
  deadline_fit: { score: number; confidence: number; rationale: string };
  risk: { score: number; confidence: number; rationale: string };
};

export type ScoringInput = {
  assessment: AssessmentInput;
  requirements: ScoredRequirement[];
  /** ISO date string, or null when the tender has no known deadline. */
  deadline: string | null;
  /** Evaluation time; injected so scoring stays deterministic in tests. */
  now: Date;
};

export type ScoreComponent = {
  key: ComponentKey;
  label: string;
  score: number;
  weight: number;
  weighted: number;
  confidence: number;
  rationale: string;
  blocking: boolean;
};

export type MandatoryFailure = {
  requirementId: string;
  title: string;
  kind: FailureKind;
  reason: string;
};

export type ScoringResult = {
  engineVersion: string;
  score: number;
  components: ScoreComponent[];
  recommendation: Recommendation;
  recommendationReasons: string[];
  confidence: number;
  evidenceCoverage: number;
  mandatoryFailures: MandatoryFailure[];
  deadlinePassed: boolean;
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Confidence at or above this level makes a no-match a CONFIRMED failure. */
export const CONFIRMED_FAILURE_CONFIDENCE = 0.7;

/**
 * Evidence strength is derived, not asked of the model: it reflects how much of
 * the mandatory / important surface of the tender is actually backed by
 * retrieved company evidence and confident verdicts.
 */
export function computeEvidenceStrength(requirements: ScoredRequirement[]): {
  score: number;
  coverage: number;
} {
  const relevant = requirements.filter(
    (r) => r.isMandatory || r.importance === "critical" || r.importance === "high",
  );
  const pool = relevant.length > 0 ? relevant : requirements;
  if (pool.length === 0) return { score: 0, coverage: 0 };

  let evidenced = 0;
  let total = 0;
  for (const r of pool) {
    total += 1;
    const hasEvidence = r.evidenceCount > 0 && r.verdict !== "unknown";
    if (hasEvidence) evidenced += Math.min(1, 0.5 + r.confidence / 2);
  }
  const coverage = evidenced / total;
  return { score: clamp(round1(coverage * 100)), coverage: round2(coverage) };
}

export function detectMandatoryFailures(
  requirements: ScoredRequirement[],
): MandatoryFailure[] {
  const failures: MandatoryFailure[] = [];
  for (const r of requirements) {
    if (!r.isMandatory) continue;
    if (r.verdict === "no_match") {
      const confirmed = r.confidence >= CONFIRMED_FAILURE_CONFIDENCE && r.evidenceCount > 0;
      failures.push({
        requirementId: r.id,
        title: r.title,
        kind: confirmed ? "confirmed" : "possible",
        reason: confirmed
          ? "Company evidence shows this mandatory requirement is not satisfied."
          : "Evidence suggests this mandatory requirement may not be satisfied, but it is not conclusive.",
      });
    } else if (r.verdict === "partial") {
      failures.push({
        requirementId: r.id,
        title: r.title,
        kind: "possible",
        reason: "Mandatory requirement is only partially supported by company evidence.",
      });
    } else if (r.verdict === "unknown") {
      failures.push({
        requirementId: r.id,
        title: r.title,
        kind: "unknown",
        reason: "No evidence was found either way for this mandatory requirement.",
      });
    }
  }
  return failures;
}

export function isDeadlinePassed(deadline: string | null, now: Date): boolean {
  if (!deadline) return false;
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < now.getTime();
}

export function computeConfidence(input: {
  requirements: ScoredRequirement[];
  assessment: AssessmentInput;
  coverage: number;
}): number {
  const { requirements, assessment, coverage } = input;
  const modelConfidence =
    COMPONENT_KEYS.filter((k) => k !== "evidence_strength").reduce(
      (sum, k) => sum + assessment[k as keyof AssessmentInput].confidence,
      0,
    ) / 7;

  const total = requirements.length;
  const unknownRatio = total === 0 ? 1 : requirements.filter((r) => r.verdict === "unknown").length / total;
  const matchConfidence =
    total === 0 ? 0 : requirements.reduce((s, r) => s + r.confidence, 0) / total;

  const raw =
    0.35 * coverage + 0.25 * matchConfidence + 0.25 * modelConfidence + 0.15 * (1 - unknownRatio);
  return round2(Math.min(1, Math.max(0, raw)));
}

export function scoreOpportunity(input: ScoringInput): ScoringResult {
  const { assessment, requirements, deadline, now } = input;

  const evidence = computeEvidenceStrength(requirements);
  const mandatoryFailures = detectMandatoryFailures(requirements);
  const deadlinePassed = isDeadlinePassed(deadline, now);
  const confirmedFailures = mandatoryFailures.filter((f) => f.kind === "confirmed");

  const rawScores: Record<ComponentKey, { score: number; confidence: number; rationale: string }> = {
    eligibility: assessment.eligibility,
    capability: assessment.capability,
    experience: assessment.experience,
    commercial_fit: assessment.commercial_fit,
    resource_fit: assessment.resource_fit,
    deadline_fit: deadlinePassed
      ? { score: 0, confidence: 1, rationale: "The submission deadline has already passed." }
      : assessment.deadline_fit,
    risk: assessment.risk,
    evidence_strength: {
      score: evidence.score,
      confidence: 1,
      rationale: `Derived from evidence coverage across mandatory and high-importance requirements (${Math.round(
        evidence.coverage * 100,
      )}%).`,
    },
  };

  const components: ScoreComponent[] = COMPONENT_KEYS.map((key) => {
    const raw = rawScores[key];
    const score = clamp(round1(raw.score));
    const weight = COMPONENT_WEIGHTS[key];
    return {
      key,
      label: COMPONENT_LABELS[key],
      score,
      weight,
      weighted: round2(score * weight),
      confidence: round2(Math.min(1, Math.max(0, raw.confidence))),
      rationale: raw.rationale,
      blocking:
        (key === "eligibility" && confirmedFailures.length > 0) ||
        (key === "deadline_fit" && deadlinePassed),
    };
  });

  const score = round1(components.reduce((sum, c) => sum + c.score * c.weight, 0));
  const confidence = computeConfidence({ requirements, assessment, coverage: evidence.coverage });

  const reasons: string[] = [];
  let recommendation: Recommendation;

  if (confirmedFailures.length > 0) {
    recommendation = "no_bid";
    reasons.push(
      `Confirmed mandatory requirement failure: ${confirmedFailures
        .map((f) => f.title)
        .slice(0, 3)
        .join("; ")}.`,
    );
  } else if (deadlinePassed) {
    recommendation = "no_bid";
    reasons.push("The submission deadline has already passed.");
  } else if (score < RECOMMENDATION_THRESHOLDS.review) {
    recommendation = "no_bid";
    reasons.push(`BidRadar score ${score} is below the no-bid threshold of ${RECOMMENDATION_THRESHOLDS.review}.`);
  } else if (score >= RECOMMENDATION_THRESHOLDS.bid) {
    const uncertain = mandatoryFailures.filter((f) => f.kind !== "confirmed");
    if (uncertain.length > 0) {
      recommendation = "review";
      reasons.push(
        `Score ${score} qualifies for BID, but ${uncertain.length} mandatory requirement(s) remain uncertain and need human verification.`,
      );
    } else if (evidence.coverage < 0.5) {
      recommendation = "review";
      reasons.push(
        `Score ${score} qualifies for BID, but only ${Math.round(
          evidence.coverage * 100,
        )}% of critical requirements are backed by company evidence.`,
      );
    } else {
      recommendation = "bid";
      reasons.push(`BidRadar score ${score} meets the bid threshold of ${RECOMMENDATION_THRESHOLDS.bid} with no confirmed blockers.`);
    }
  } else {
    recommendation = "review";
    reasons.push(
      `BidRadar score ${score} falls in the review band (${RECOMMENDATION_THRESHOLDS.review}–${RECOMMENDATION_THRESHOLDS.bid - 1}).`,
    );
  }

  const unknownMandatory = mandatoryFailures.filter((f) => f.kind === "unknown");
  if (unknownMandatory.length > 0 && recommendation !== "no_bid") {
    reasons.push(
      `${unknownMandatory.length} mandatory requirement(s) could not be evaluated from available company evidence.`,
    );
  }

  return {
    engineVersion: SCORING_ENGINE_VERSION,
    score,
    components,
    recommendation,
    recommendationReasons: reasons,
    confidence,
    evidenceCoverage: evidence.coverage,
    mandatoryFailures,
    deadlinePassed,
  };
}
