/**
 * Deterministic Submission Readiness Calculator
 *
 * Pure functions: the same inputs always produce the same readiness score and status.
 * AI recommendations are NEVER used to derive readiness — only application state counts.
 *
 * Readiness formula (out of 100):
 *   - Mandatory requirements satisfied (evidence/tasks linked): 40 pts
 *   - Tasks completion rate:                                     30 pts
 *   - Proposal sections drafted (≥1):                           15 pts
 *   - No blockers penalty:                                       15 pts
 *
 * Thresholds:
 *   ≥ 85 → SUBMISSION READY
 *   ≥ 65 → READY FOR REVIEW
 *   ≥ 30 → IN PROGRESS
 *   <  30 → NOT READY
 */

export type ReadinessStatus = "NOT_READY" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "SUBMISSION_READY";

export interface ReadinessRequirement {
  id: string;
  requirement: string;
  category: string | null;
  is_mandatory: boolean;
  /** Verdict from AI extraction: "met" | "partial" | "gap" | null */
  evidence_status: string | null;
}

export interface ReadinessTask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "blocked" | "completed";
  priority: string;
  due_date: string | null;
  requirement_id: string | null;
}

export interface ReadinessProposal {
  id: string;
  title: string;
}

export interface ReadinessInput {
  requirements: ReadinessRequirement[];
  tasks: ReadinessTask[];
  proposals: ReadinessProposal[];
  /** ISO date string or null */
  submissionDeadline: string | null;
  /** Injected so calculation stays deterministic in tests */
  now?: Date;
}

export interface ReadinessBreakdown {
  mandatoryScore: number; // 0..40
  tasksScore: number; // 0..30
  proposalsScore: number; // 0..15
  noBlockersScore: number; // 0..15
  total: number; // 0..100
}

export interface CriticalGap {
  requirementId: string;
  requirement: string;
  category: string | null;
  evidenceStatus: string | null;
  linkedTaskId: string | null;
}

export interface DeadlineIntelligence {
  deadline: Date | null;
  daysRemaining: number | null;
  isOverdue: boolean;
  urgencyLevel: "none" | "safe" | "warning" | "critical" | "overdue";
  overdueTasks: ReadinessTask[];
  tasksDueSoon: ReadinessTask[];
}

export interface ReadinessReport {
  status: ReadinessStatus;
  score: number;
  breakdown: ReadinessBreakdown;
  criticalGaps: CriticalGap[];
  deadlineIntelligence: DeadlineIntelligence;
  mandatoryRequirementCount: number;
  satisfiedMandatoryCount: number;
  completedTaskCount: number;
  blockedTaskCount: number;
  totalTaskCount: number;
  proposalCount: number;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/** Returns true when a requirement's evidence status indicates it is met. */
function isRequirementSatisfied(r: ReadinessRequirement): boolean {
  return r.evidence_status === "met";
}

/** Returns true when a task is linked to a given requirement and is completed. */
function hasCompletedTaskFor(tasks: ReadinessTask[], reqId: string): boolean {
  return tasks.some((t) => t.requirement_id === reqId && t.status === "completed");
}

// ────────────────────────────────────────────────────────────────
// Main calculation
// ────────────────────────────────────────────────────────────────

export function calculateReadiness(input: ReadinessInput): ReadinessReport {
  const now = input.now ?? new Date();

  // ── 1. Mandatory requirements component (0..40 pts) ──────────
  const mandatoryReqs = input.requirements.filter((r) => r.is_mandatory);
  const mandatoryCount = mandatoryReqs.length;

  const satisfiedMandatory = mandatoryReqs.filter(
    (r) => isRequirementSatisfied(r) || hasCompletedTaskFor(input.tasks, r.id),
  );
  const satisfiedCount = satisfiedMandatory.length;

  const mandatoryScore =
    mandatoryCount === 0
      ? 40 // no mandatory requirements → full marks for this component
      : Math.round((satisfiedCount / mandatoryCount) * 40);

  // ── 2. Tasks completion component (0..30 pts) ─────────────────
  const totalTasks = input.tasks.length;
  const completedTasks = input.tasks.filter((t) => t.status === "completed").length;
  const blockedTasks = input.tasks.filter((t) => t.status === "blocked");

  const tasksScore = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 30);

  // ── 3. Proposal sections component (0..15 pts) ───────────────
  const proposalScore =
    input.proposals.length >= 3
      ? 15
      : input.proposals.length === 2
        ? 11
        : input.proposals.length === 1
          ? 7
          : 0;

  // ── 4. No blockers component (0..15 pts) ─────────────────────
  const blockerPenaltyPerTask = 5;
  const noBlockersScore = Math.max(0, 15 - blockedTasks.length * blockerPenaltyPerTask);

  // ── 5. Total ─────────────────────────────────────────────────
  const total = Math.min(100, mandatoryScore + tasksScore + proposalScore + noBlockersScore);

  // ── 6. Status tier ───────────────────────────────────────────
  let status: ReadinessStatus;
  if (total >= 85) status = "SUBMISSION_READY";
  else if (total >= 65) status = "READY_FOR_REVIEW";
  else if (total >= 30) status = "IN_PROGRESS";
  else status = "NOT_READY";

  // ── 7. Critical gaps ─────────────────────────────────────────
  const criticalGaps: CriticalGap[] = mandatoryReqs
    .filter((r) => !isRequirementSatisfied(r) && !hasCompletedTaskFor(input.tasks, r.id))
    .map((r) => {
      const linkedTask = input.tasks.find((t) => t.requirement_id === r.id) ?? null;
      return {
        requirementId: r.id,
        requirement: r.requirement,
        category: r.category,
        evidenceStatus: r.evidence_status,
        linkedTaskId: linkedTask?.id ?? null,
      };
    });

  // ── 8. Deadline intelligence ──────────────────────────────────
  let deadlineDate: Date | null = null;
  let daysRemaining: number | null = null;
  let isOverdue = false;

  if (input.submissionDeadline) {
    deadlineDate = new Date(input.submissionDeadline);
    const msRemaining = deadlineDate.getTime() - now.getTime();
    daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    isOverdue = msRemaining < 0;
  }

  let urgencyLevel: DeadlineIntelligence["urgencyLevel"] = "none";
  if (isOverdue) {
    urgencyLevel = "overdue";
  } else if (daysRemaining !== null) {
    if (daysRemaining <= 2) urgencyLevel = "critical";
    else if (daysRemaining <= 7) urgencyLevel = "warning";
    else urgencyLevel = "safe";
  }

  const overdueTasks = input.tasks.filter((t) => {
    if (!t.due_date || t.status === "completed") return false;
    return new Date(t.due_date).getTime() < now.getTime();
  });

  const tasksDueSoon = input.tasks.filter((t) => {
    if (!t.due_date || t.status === "completed") return false;
    const msUntilDue = new Date(t.due_date).getTime() - now.getTime();
    return msUntilDue >= 0 && msUntilDue <= 48 * 60 * 60 * 1000;
  });

  return {
    status,
    score: total,
    breakdown: {
      mandatoryScore,
      tasksScore,
      proposalsScore: proposalScore,
      noBlockersScore,
      total,
    },
    criticalGaps,
    deadlineIntelligence: {
      deadline: deadlineDate,
      daysRemaining,
      isOverdue,
      urgencyLevel,
      overdueTasks,
      tasksDueSoon,
    },
    mandatoryRequirementCount: mandatoryCount,
    satisfiedMandatoryCount: satisfiedCount,
    completedTaskCount: completedTasks,
    blockedTaskCount: blockedTasks.length,
    totalTaskCount: totalTasks,
    proposalCount: input.proposals.length,
  };
}

// ────────────────────────────────────────────────────────────────
// Display helpers
// ────────────────────────────────────────────────────────────────

export function readinessStatusLabel(status: ReadinessStatus): string {
  switch (status) {
    case "SUBMISSION_READY":
      return "Submission Ready";
    case "READY_FOR_REVIEW":
      return "Ready for Review";
    case "IN_PROGRESS":
      return "In Progress";
    case "NOT_READY":
    default:
      return "Not Ready";
  }
}

export function readinessStatusColor(status: ReadinessStatus): string {
  switch (status) {
    case "SUBMISSION_READY":
      return "text-emerald-600 dark:text-emerald-400";
    case "READY_FOR_REVIEW":
      return "text-blue-600 dark:text-blue-400";
    case "IN_PROGRESS":
      return "text-amber-600 dark:text-amber-400";
    case "NOT_READY":
    default:
      return "text-destructive";
  }
}

export function readinessStatusBorder(status: ReadinessStatus): string {
  switch (status) {
    case "SUBMISSION_READY":
      return "border-emerald-500/40 bg-emerald-500/10";
    case "READY_FOR_REVIEW":
      return "border-blue-500/40 bg-blue-500/10";
    case "IN_PROGRESS":
      return "border-amber-500/40 bg-amber-500/10";
    case "NOT_READY":
    default:
      return "border-destructive/40 bg-destructive/10";
  }
}
