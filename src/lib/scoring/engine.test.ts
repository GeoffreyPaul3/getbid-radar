import { describe, expect, it } from "vitest";
import {
  computeConfidence,
  computeEvidenceStrength,
  detectMandatoryFailures,
  isDeadlinePassed,
  scoreOpportunity,
  type AssessmentInput,
  type ScoredRequirement,
} from "./engine";
import { COMPONENT_WEIGHTS, RECOMMENDATION_THRESHOLDS, SCORING_ENGINE_VERSION } from "./weights";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function assessment(score: number, confidence = 0.9): AssessmentInput {
  const c = { score, confidence, rationale: "fixture" };
  return {
    eligibility: c,
    capability: c,
    experience: c,
    commercial_fit: c,
    resource_fit: c,
    deadline_fit: c,
    risk: c,
  };
}

/** A fully-evidenced, non-mandatory requirement → evidence strength = 100. */
function evidencedRequirement(overrides: Partial<ScoredRequirement> = {}): ScoredRequirement {
  return {
    id: "req-1",
    title: "Fully evidenced requirement",
    isMandatory: false,
    importance: "high",
    verdict: "match",
    confidence: 1,
    evidenceCount: 2,
    ...overrides,
  };
}

describe("weights", () => {
  it("component weights sum to exactly 1", () => {
    const total = Object.values(COMPONENT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.round(total * 1000) / 1000).toBe(1);
  });
});

describe("threshold boundaries", () => {
  const cases: Array<[number, "bid" | "review" | "no_bid"]> = [
    [0, "no_bid"],
    [49, "no_bid"],
    [50, "review"],
    [74, "review"],
    [75, "bid"],
    [100, "bid"],
  ];

  for (const [score, expected] of cases) {
    it(`score ${score} → ${expected}`, () => {
      const result = scoreOpportunity({
        assessment: assessment(score),
        requirements: [evidencedRequirement()],
        deadline: "2026-06-01T00:00:00.000Z",
        now: NOW,
      });
      expect(result.score).toBe(score);
      expect(result.recommendation).toBe(expected);
    });
  }

  it("uses the documented thresholds", () => {
    expect(RECOMMENDATION_THRESHOLDS).toEqual({ bid: 75, review: 50 });
  });
});

describe("weighted component calculation", () => {
  it("weights each component according to the configuration", () => {
    const result = scoreOpportunity({
      assessment: {
        ...assessment(0),
        eligibility: { score: 100, confidence: 1, rationale: "" },
      },
      requirements: [],
      deadline: null,
      now: NOW,
    });
    // eligibility weight 0.2 → 20, everything else 0 (no requirements → evidence 0)
    expect(result.score).toBe(20);
    const eligibility = result.components.find((c) => c.key === "eligibility")!;
    expect(eligibility.weight).toBe(0.2);
    expect(eligibility.weighted).toBe(20);
    expect(result.components).toHaveLength(8);
  });

  it("is deterministic for identical input", () => {
    const input = {
      assessment: assessment(72, 0.6),
      requirements: [
        evidencedRequirement(),
        evidencedRequirement({ id: "req-2", isMandatory: true, verdict: "match" }),
      ],
      deadline: "2026-05-01T00:00:00.000Z",
      now: NOW,
    };
    const a = scoreOpportunity(input);
    const b = scoreOpportunity(input);
    expect(a).toEqual(b);
    expect(a.engineVersion).toBe(SCORING_ENGINE_VERSION);
  });
});

describe("mandatory failures", () => {
  it("confirmed mandatory failure forces NO-BID even at a BID score", () => {
    const result = scoreOpportunity({
      assessment: assessment(100),
      requirements: [
        evidencedRequirement(),
        evidencedRequirement({
          id: "req-fail",
          title: "ISO 9001 required",
          isMandatory: true,
          verdict: "no_match",
          confidence: 0.9,
          evidenceCount: 1,
        }),
      ],
      deadline: null,
      now: NOW,
    });
    expect(result.recommendation).toBe("no_bid");
    expect(result.mandatoryFailures.some((f) => f.kind === "confirmed")).toBe(true);
    expect(result.components.find((c) => c.key === "eligibility")!.blocking).toBe(true);
  });

  it("possible mandatory failure does not force NO-BID", () => {
    const result = scoreOpportunity({
      assessment: assessment(100),
      requirements: [
        evidencedRequirement(),
        evidencedRequirement({
          id: "req-maybe",
          isMandatory: true,
          verdict: "no_match",
          confidence: 0.2,
          evidenceCount: 1,
        }),
      ],
      deadline: null,
      now: NOW,
    });
    expect(result.mandatoryFailures[0]!.kind).toBe("possible");
    expect(result.recommendation).toBe("review");
  });

  it("unknown mandatory status does not force NO-BID", () => {
    const result = scoreOpportunity({
      assessment: assessment(100),
      requirements: [
        evidencedRequirement(),
        evidencedRequirement({
          id: "req-unknown",
          isMandatory: true,
          verdict: "unknown",
          confidence: 0,
          evidenceCount: 0,
        }),
      ],
      deadline: null,
      now: NOW,
    });
    expect(result.mandatoryFailures.map((f) => f.kind)).toEqual(["unknown"]);
    expect(result.recommendation).toBe("review");
  });

  it("preserves every blocker rather than only the first", () => {
    const failures = detectMandatoryFailures([
      evidencedRequirement({ id: "a", isMandatory: true, verdict: "no_match", confidence: 0.95 }),
      evidencedRequirement({ id: "b", isMandatory: true, verdict: "partial", confidence: 0.8 }),
      evidencedRequirement({ id: "c", isMandatory: true, verdict: "unknown", evidenceCount: 0 }),
      evidencedRequirement({ id: "d", isMandatory: false, verdict: "no_match", confidence: 0.95 }),
    ]);
    expect(failures.map((f) => `${f.requirementId}:${f.kind}`)).toEqual([
      "a:confirmed",
      "b:possible",
      "c:unknown",
    ]);
  });
});

describe("deadline handling", () => {
  it("future deadline is not passed", () => {
    expect(isDeadlinePassed("2026-02-01T00:00:00.000Z", NOW)).toBe(false);
  });

  it("later today is not passed", () => {
    expect(isDeadlinePassed("2026-01-01T23:59:00.000Z", NOW)).toBe(false);
  });

  it("expired deadline forces NO-BID and zeroes deadline fit", () => {
    const result = scoreOpportunity({
      assessment: assessment(100),
      requirements: [evidencedRequirement()],
      deadline: "2025-12-31T23:00:00.000Z",
      now: NOW,
    });
    expect(result.deadlinePassed).toBe(true);
    expect(result.recommendation).toBe("no_bid");
    const deadlineComponent = result.components.find((c) => c.key === "deadline_fit")!;
    expect(deadlineComponent.score).toBe(0);
    expect(deadlineComponent.blocking).toBe(true);
  });

  it("missing deadline is never treated as expired", () => {
    expect(isDeadlinePassed(null, NOW)).toBe(false);
  });

  it("unparseable deadline is never treated as expired", () => {
    expect(isDeadlinePassed("as soon as possible", NOW)).toBe(false);
    expect(isDeadlinePassed("Q3", NOW)).toBe(false);
  });
});

describe("confidence", () => {
  const strong: ScoredRequirement[] = [
    evidencedRequirement({ id: "1", confidence: 0.95 }),
    evidencedRequirement({ id: "2", confidence: 0.9 }),
  ];
  const weak: ScoredRequirement[] = [
    evidencedRequirement({ id: "1", confidence: 0.2, evidenceCount: 1 }),
    evidencedRequirement({ id: "2", confidence: 0.15, evidenceCount: 1 }),
  ];
  const missing: ScoredRequirement[] = [
    evidencedRequirement({ id: "1", verdict: "unknown", confidence: 0, evidenceCount: 0 }),
    evidencedRequirement({ id: "2", verdict: "unknown", confidence: 0, evidenceCount: 0 }),
  ];

  it("strong evidence outranks weak evidence, which outranks missing evidence", () => {
    const c = (reqs: ScoredRequirement[]) =>
      computeConfidence({
        requirements: reqs,
        assessment: assessment(80),
        coverage: computeEvidenceStrength(reqs).coverage,
      });
    expect(c(strong)).toBeGreaterThan(c(weak));
    expect(c(weak)).toBeGreaterThan(c(missing));
  });

  it("a high score does not imply high confidence", () => {
    const result = scoreOpportunity({
      assessment: assessment(100, 0.2),
      requirements: [
        evidencedRequirement({ id: "1", confidence: 0.9 }),
        ...Array.from({ length: 6 }, (_, i) =>
          evidencedRequirement({
            id: `u${i}`,
            importance: "medium",
            verdict: "unknown",
            confidence: 0,
            evidenceCount: 0,
          }),
        ),
      ],
      deadline: null,
      now: NOW,
    });
    expect(result.score).toBeGreaterThanOrEqual(RECOMMENDATION_THRESHOLDS.bid);
    expect(result.confidence).toBeLessThan(0.6);
  });

  it("holds a high-scoring bid at REVIEW when evidence coverage is thin", () => {
    const result = scoreOpportunity({
      assessment: assessment(100),
      requirements: [
        evidencedRequirement({ id: "1" }),
        evidencedRequirement({ id: "2", verdict: "unknown", confidence: 0, evidenceCount: 0 }),
        evidencedRequirement({ id: "3", verdict: "unknown", confidence: 0, evidenceCount: 0 }),
      ],
      deadline: null,
      now: NOW,
    });
    expect(result.evidenceCoverage).toBeLessThan(0.5);
    expect(result.recommendation).toBe("review");
  });

  it("evidence strength is 0 when nothing is evidenced", () => {
    expect(computeEvidenceStrength(missing)).toEqual({ score: 0, coverage: 0 });
  });
});
