/**
 * Deterministic submission readiness calculator tests.
 * Pure function tests — no mocks, no async, no external dependencies.
 */
import { describe, it, expect } from "vitest";
import {
  calculateReadiness,
  readinessStatusLabel,
  readinessStatusColor,
  readinessStatusBorder,
  type ReadinessInput,
  type ReadinessRequirement,
  type ReadinessTask,
  type ReadinessProposal,
} from "./readiness";

// ────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────

const NOW = new Date("2026-01-15T12:00:00Z");

const mandatoryReq = (id: string, evidenceStatus: string | null = null): ReadinessRequirement => ({
  id,
  requirement: `Mandatory requirement ${id}`,
  category: "Compliance",
  is_mandatory: true,
  evidence_status: evidenceStatus,
});

const optionalReq = (id: string): ReadinessRequirement => ({
  id,
  requirement: `Optional requirement ${id}`,
  category: "Technical",
  is_mandatory: false,
  evidence_status: null,
});

const task = (
  id: string,
  status: ReadinessTask["status"],
  opts: Partial<Pick<ReadinessTask, "priority" | "due_date" | "requirement_id">> = {},
): ReadinessTask => ({
  id,
  title: `Task ${id}`,
  status,
  priority: opts.priority ?? "medium",
  due_date: opts.due_date ?? null,
  requirement_id: opts.requirement_id ?? null,
});

const proposal = (id: string): ReadinessProposal => ({ id, title: `Section ${id}` });

const baseInput = (overrides: Partial<ReadinessInput> = {}): ReadinessInput => ({
  requirements: [],
  tasks: [],
  proposals: [],
  submissionDeadline: null,
  now: NOW,
  ...overrides,
});

// ────────────────────────────────────────────────────────────────
// Score component tests
// ────────────────────────────────────────────────────────────────

describe("calculateReadiness — mandatory requirements component (0–40)", () => {
  it("gives full 40 pts when there are no mandatory requirements", () => {
    const report = calculateReadiness(baseInput({ requirements: [optionalReq("r1")] }));
    expect(report.breakdown.mandatoryScore).toBe(40);
  });

  it("gives 0 pts when all mandatory requirements are unmet", () => {
    const report = calculateReadiness(
      baseInput({ requirements: [mandatoryReq("r1"), mandatoryReq("r2")] }),
    );
    expect(report.breakdown.mandatoryScore).toBe(0);
  });

  it("gives 40 pts when all mandatory requirements are met", () => {
    const report = calculateReadiness(
      baseInput({
        requirements: [mandatoryReq("r1", "met"), mandatoryReq("r2", "met")],
      }),
    );
    expect(report.breakdown.mandatoryScore).toBe(40);
  });

  it("gives partial pts proportional to met ratio", () => {
    const report = calculateReadiness(
      baseInput({
        requirements: [
          mandatoryReq("r1", "met"),
          mandatoryReq("r2"),
          mandatoryReq("r3"),
          mandatoryReq("r4"),
        ],
      }),
    );
    // 1 of 4 met → 10 pts
    expect(report.breakdown.mandatoryScore).toBe(10);
  });

  it("counts a completed task linked to a mandatory requirement as satisfying it", () => {
    const report = calculateReadiness(
      baseInput({
        requirements: [mandatoryReq("r1")],
        tasks: [task("t1", "completed", { requirement_id: "r1" })],
      }),
    );
    expect(report.breakdown.mandatoryScore).toBe(40);
    expect(report.satisfiedMandatoryCount).toBe(1);
  });

  it("does NOT count an in-progress task as satisfying a requirement", () => {
    const report = calculateReadiness(
      baseInput({
        requirements: [mandatoryReq("r1")],
        tasks: [task("t1", "in_progress", { requirement_id: "r1" })],
      }),
    );
    expect(report.breakdown.mandatoryScore).toBe(0);
    expect(report.satisfiedMandatoryCount).toBe(0);
  });
});

describe("calculateReadiness — tasks component (0–30)", () => {
  it("gives 0 pts when there are no tasks", () => {
    const report = calculateReadiness(baseInput());
    expect(report.breakdown.tasksScore).toBe(0);
  });

  it("gives 30 pts when all tasks are completed", () => {
    const report = calculateReadiness(
      baseInput({ tasks: [task("t1", "completed"), task("t2", "completed")] }),
    );
    expect(report.breakdown.tasksScore).toBe(30);
  });

  it("gives 0 pts when no tasks are completed", () => {
    const report = calculateReadiness(
      baseInput({ tasks: [task("t1", "todo"), task("t2", "in_progress")] }),
    );
    expect(report.breakdown.tasksScore).toBe(0);
  });

  it("gives proportional pts for partial completion", () => {
    const report = calculateReadiness(
      baseInput({
        tasks: [
          task("t1", "completed"),
          task("t2", "todo"),
          task("t3", "todo"),
          task("t4", "todo"),
        ],
      }),
    );
    // 1/4 completed → 8 pts (rounded)
    expect(report.breakdown.tasksScore).toBe(Math.round((1 / 4) * 30));
  });
});

describe("calculateReadiness — proposals component (0–15)", () => {
  it("gives 0 pts for no proposals", () => {
    const report = calculateReadiness(baseInput());
    expect(report.breakdown.proposalsScore).toBe(0);
  });

  it("gives 7 pts for 1 proposal section", () => {
    const report = calculateReadiness(baseInput({ proposals: [proposal("p1")] }));
    expect(report.breakdown.proposalsScore).toBe(7);
  });

  it("gives 11 pts for 2 proposal sections", () => {
    const report = calculateReadiness(baseInput({ proposals: [proposal("p1"), proposal("p2")] }));
    expect(report.breakdown.proposalsScore).toBe(11);
  });

  it("gives 15 pts for 3+ proposal sections", () => {
    const report = calculateReadiness(
      baseInput({ proposals: [proposal("p1"), proposal("p2"), proposal("p3")] }),
    );
    expect(report.breakdown.proposalsScore).toBe(15);
  });

  it("caps at 15 pts even with many proposals", () => {
    const report = calculateReadiness(
      baseInput({
        proposals: [proposal("p1"), proposal("p2"), proposal("p3"), proposal("p4"), proposal("p5")],
      }),
    );
    expect(report.breakdown.proposalsScore).toBe(15);
  });
});

describe("calculateReadiness — no blockers component (0–15)", () => {
  it("gives 15 pts when there are no blocked tasks", () => {
    const report = calculateReadiness(
      baseInput({ tasks: [task("t1", "todo"), task("t2", "completed")] }),
    );
    expect(report.breakdown.noBlockersScore).toBe(15);
  });

  it("deducts 5 pts per blocked task", () => {
    const report = calculateReadiness(
      baseInput({ tasks: [task("t1", "blocked"), task("t2", "blocked")] }),
    );
    expect(report.breakdown.noBlockersScore).toBe(5);
  });

  it("clamps to 0 with 3+ blocked tasks", () => {
    const report = calculateReadiness(
      baseInput({
        tasks: [task("t1", "blocked"), task("t2", "blocked"), task("t3", "blocked")],
      }),
    );
    expect(report.breakdown.noBlockersScore).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────
// Status tier tests
// ────────────────────────────────────────────────────────────────

describe("calculateReadiness — status tiers", () => {
  it("is IN_PROGRESS with score 55 (empty workspace — no requirements or tasks)", () => {
    // Empty workspace: no mandatory reqs → 40 pts, no tasks → 0, no proposals → 0, no blockers → 15 pts = 55 total
    const report = calculateReadiness(baseInput());
    expect(report.score).toBe(55);
    expect(report.status).toBe("IN_PROGRESS");
  });

  it("is SUBMISSION_READY with ≥85 score", () => {
    // No mandatory reqs (40) + all tasks done (30) + 3 proposals (15) + no blockers (15) = 100
    const report = calculateReadiness(
      baseInput({
        tasks: [task("t1", "completed"), task("t2", "completed")],
        proposals: [proposal("p1"), proposal("p2"), proposal("p3")],
      }),
    );
    expect(report.score).toBe(100);
    expect(report.status).toBe("SUBMISSION_READY");
  });

  it("is IN_PROGRESS with score between 30 and 64", () => {
    // No mandatory reqs (40) + 0 tasks = 40 pts total → IN_PROGRESS
    const report = calculateReadiness(baseInput({ tasks: [task("t1", "todo")] }));
    // 40 + 0 + 0 + 10 = 50 (1 blocked = -5, but t1 is todo so noBlockers=15)
    // Actually: mandatoryScore=40, tasksScore=0, proposalScore=0, noBlockersScore=15 → 55
    expect(report.score).toBe(55);
    expect(report.status).toBe("IN_PROGRESS");
  });
});

// ────────────────────────────────────────────────────────────────
// Critical gaps tests
// ────────────────────────────────────────────────────────────────

describe("calculateReadiness — critical gaps", () => {
  it("returns no gaps when all mandatory requirements are met", () => {
    const report = calculateReadiness(
      baseInput({ requirements: [mandatoryReq("r1", "met"), mandatoryReq("r2", "met")] }),
    );
    expect(report.criticalGaps).toHaveLength(0);
  });

  it("returns a gap for each unsatisfied mandatory requirement", () => {
    const report = calculateReadiness(
      baseInput({
        requirements: [mandatoryReq("r1"), mandatoryReq("r2"), mandatoryReq("r3", "met")],
      }),
    );
    expect(report.criticalGaps).toHaveLength(2);
    const gapIds = report.criticalGaps.map((g) => g.requirementId);
    expect(gapIds).toContain("r1");
    expect(gapIds).toContain("r2");
  });

  it("does not list optional requirements as gaps", () => {
    const report = calculateReadiness(
      baseInput({ requirements: [optionalReq("r1"), optionalReq("r2")] }),
    );
    expect(report.criticalGaps).toHaveLength(0);
  });

  it("identifies linked task ID for a gap with existing task", () => {
    const report = calculateReadiness(
      baseInput({
        requirements: [mandatoryReq("r1")],
        tasks: [task("t1", "in_progress", { requirement_id: "r1" })],
      }),
    );
    expect(report.criticalGaps[0]?.linkedTaskId).toBe("t1");
  });
});

// ────────────────────────────────────────────────────────────────
// Deadline intelligence tests
// ────────────────────────────────────────────────────────────────

describe("calculateReadiness — deadline intelligence", () => {
  it("returns null deadline when not specified", () => {
    const report = calculateReadiness(baseInput());
    expect(report.deadlineIntelligence.deadline).toBeNull();
    expect(report.deadlineIntelligence.daysRemaining).toBeNull();
    expect(report.deadlineIntelligence.urgencyLevel).toBe("none");
  });

  it("calculates safe urgency for deadline >7 days away", () => {
    const report = calculateReadiness(baseInput({ submissionDeadline: "2026-01-30T00:00:00Z" }));
    expect(report.deadlineIntelligence.urgencyLevel).toBe("safe");
    expect(report.deadlineIntelligence.isOverdue).toBe(false);
  });

  it("calculates warning urgency for deadline within 2-7 days", () => {
    const report = calculateReadiness(
      baseInput({ submissionDeadline: "2026-01-20T00:00:00Z" }), // 5 days from NOW
    );
    expect(report.deadlineIntelligence.urgencyLevel).toBe("warning");
  });

  it("calculates critical urgency for deadline within 48h", () => {
    const report = calculateReadiness(
      baseInput({ submissionDeadline: "2026-01-16T00:00:00Z" }), // ~1 day from NOW
    );
    expect(report.deadlineIntelligence.urgencyLevel).toBe("critical");
  });

  it("calculates overdue when deadline has passed", () => {
    const report = calculateReadiness(
      baseInput({ submissionDeadline: "2026-01-10T00:00:00Z" }), // 5 days before NOW
    );
    expect(report.deadlineIntelligence.isOverdue).toBe(true);
    expect(report.deadlineIntelligence.urgencyLevel).toBe("overdue");
  });

  it("identifies overdue tasks", () => {
    const report = calculateReadiness(
      baseInput({
        tasks: [
          task("t1", "todo", { due_date: "2026-01-10T00:00:00Z" }), // overdue
          task("t2", "todo", { due_date: "2026-01-20T00:00:00Z" }), // not overdue
          task("t3", "completed", { due_date: "2026-01-10T00:00:00Z" }), // completed, not counted
        ],
      }),
    );
    expect(report.deadlineIntelligence.overdueTasks).toHaveLength(1);
    expect(report.deadlineIntelligence.overdueTasks[0]?.id).toBe("t1");
  });

  it("identifies tasks due within 48h", () => {
    const report = calculateReadiness(
      baseInput({
        tasks: [
          task("t1", "todo", { due_date: "2026-01-16T00:00:00Z" }), // ~24h from NOW
          task("t2", "todo", { due_date: "2026-01-30T00:00:00Z" }), // 15 days away
        ],
      }),
    );
    expect(report.deadlineIntelligence.tasksDueSoon).toHaveLength(1);
    expect(report.deadlineIntelligence.tasksDueSoon[0]?.id).toBe("t1");
  });
});

// ────────────────────────────────────────────────────────────────
// Display helper tests
// ────────────────────────────────────────────────────────────────

describe("readiness display helpers", () => {
  it("returns correct status labels", () => {
    expect(readinessStatusLabel("SUBMISSION_READY")).toBe("Submission Ready");
    expect(readinessStatusLabel("READY_FOR_REVIEW")).toBe("Ready for Review");
    expect(readinessStatusLabel("IN_PROGRESS")).toBe("In Progress");
    expect(readinessStatusLabel("NOT_READY")).toBe("Not Ready");
  });

  it("returns distinct color classes for each status", () => {
    const statuses = ["SUBMISSION_READY", "READY_FOR_REVIEW", "IN_PROGRESS", "NOT_READY"] as const;
    const colors = statuses.map(readinessStatusColor);
    // All must be distinct strings
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(4);
  });

  it("returns distinct border classes for each status", () => {
    const statuses = ["SUBMISSION_READY", "READY_FOR_REVIEW", "IN_PROGRESS", "NOT_READY"] as const;
    const borders = statuses.map(readinessStatusBorder);
    const uniqueBorders = new Set(borders);
    expect(uniqueBorders.size).toBe(4);
  });
});

// ────────────────────────────────────────────────────────────────
// Total score boundary tests
// ────────────────────────────────────────────────────────────────

describe("calculateReadiness — total score boundaries", () => {
  it("score is always between 0 and 100 inclusive", () => {
    const scenarios: ReadinessInput[] = [
      baseInput(),
      baseInput({
        requirements: [mandatoryReq("r1", "met")],
        tasks: [task("t1", "completed"), task("t2", "completed")],
        proposals: [proposal("p1"), proposal("p2"), proposal("p3")],
      }),
      baseInput({
        requirements: [mandatoryReq("r1"), mandatoryReq("r2")],
        tasks: [task("t1", "blocked"), task("t2", "blocked"), task("t3", "blocked")],
      }),
    ];

    for (const input of scenarios) {
      const report = calculateReadiness(input);
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
    }
  });

  it("total breakdown sum equals total score", () => {
    const report = calculateReadiness(
      baseInput({
        requirements: [mandatoryReq("r1", "met"), mandatoryReq("r2")],
        tasks: [task("t1", "completed"), task("t2", "todo"), task("t3", "blocked")],
        proposals: [proposal("p1")],
      }),
    );
    const sum =
      report.breakdown.mandatoryScore +
      report.breakdown.tasksScore +
      report.breakdown.proposalsScore +
      report.breakdown.noBlockersScore;
    expect(report.score).toBe(sum);
  });
});
