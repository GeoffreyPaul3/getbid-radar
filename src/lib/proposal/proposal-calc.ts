/**
 * Canonical Proposal Completeness Engine.
 *
 * Deterministic rules:
 * - Completeness is strictly evaluated against canonical REQUIRED proposal section types:
 *   ["executive_summary", "technical_approach", "financial_proposal"]
 * - Every required section type complete => exactly 100%
 * - Any required section missing => strictly below 100%
 * - Any required section incomplete => strictly below 100%
 * - Optional sections missing => does NOT prevent 100%
 * - Empty proposal => exactly 0%
 * - Duplicate sections of the same type => counted at most once, never inflates score
 * - Unresolved evidence gaps [Evidence required: ...] => prevents section completion
 */

export const REQUIRED_PROPOSAL_SECTION_TYPES = [
  "executive_summary",
  "technical_approach",
  "financial_proposal",
] as const;

export type RequiredProposalSectionType = (typeof REQUIRED_PROPOSAL_SECTION_TYPES)[number];

export interface ProposalSectionItem {
  id?: string | undefined;
  section_type: string;
  completeness_status?: string | null | undefined;
  content?: string | null | undefined;
}

export interface ProposalCompletenessResult {
  score: number;
  drafted: number;
  completed: number;
  total: number;
  hasEvidenceGaps: boolean;
  requiredSectionsStatus: Record<
    RequiredProposalSectionType,
    "missing" | "draft" | "in_progress" | "complete"
  >;
}

/**
 * Checks whether a single section is considered complete.
 * A section cannot be complete if it has missing content or unresolved [Evidence required: ...] tags.
 */
export function isSectionComplete(section: ProposalSectionItem): boolean {
  if (!section.content || section.content.trim().length === 0) {
    return false;
  }
  if (section.content.includes("[Evidence required:")) {
    return false;
  }
  if (section.completeness_status === "complete") {
    return true;
  }
  // Substantive content without evidence gaps qualifies as complete
  return section.content.trim().length >= 100;
}

/**
 * Checks whether a section is drafted or in progress.
 */
export function isSectionInProgress(section: ProposalSectionItem): boolean {
  if (isSectionComplete(section)) return false;
  if (!section.content || section.content.trim().length === 0) return false;
  return true;
}

/**
 * Derives section completeness status string for database storage.
 */
export function deriveCompleteness(
  content: string | null | undefined,
): "draft" | "in_progress" | "complete" | "evidence_required" {
  if (!content || content.trim().length === 0) return "draft";
  if (content.includes("[Evidence required:")) return "evidence_required";
  if (content.trim().length >= 100) return "complete";
  return "in_progress";
}

/**
 * Computes canonical Proposal Completeness (0-100%) based on required section types.
 */
export function computeProposalCompleteness(
  sections: ProposalSectionItem[],
): ProposalCompletenessResult {
  const totalRequired = REQUIRED_PROPOSAL_SECTION_TYPES.length;

  if (!sections || sections.length === 0) {
    return {
      score: 0,
      drafted: 0,
      completed: 0,
      total: totalRequired,
      hasEvidenceGaps: false,
      requiredSectionsStatus: {
        executive_summary: "missing",
        technical_approach: "missing",
        financial_proposal: "missing",
      },
    };
  }

  const hasEvidenceGaps = sections.some((s) => s.content?.includes("[Evidence required:"));

  let completedRequiredCount = 0;
  let inProgressRequiredCount = 0;

  const requiredSectionsStatus: Record<
    RequiredProposalSectionType,
    "missing" | "draft" | "in_progress" | "complete"
  > = {
    executive_summary: "missing",
    technical_approach: "missing",
    financial_proposal: "missing",
  };

  for (const reqType of REQUIRED_PROPOSAL_SECTION_TYPES) {
    const matching = sections.filter((s) => s.section_type === reqType);

    if (matching.length === 0) {
      requiredSectionsStatus[reqType] = "missing";
      continue;
    }

    // At least one complete section of this type satisfies the required section
    const hasComplete = matching.some((s) => isSectionComplete(s));

    if (hasComplete) {
      requiredSectionsStatus[reqType] = "complete";
      completedRequiredCount++;
    } else {
      const hasProgress = matching.some((s) => isSectionInProgress(s));
      if (hasProgress) {
        requiredSectionsStatus[reqType] = "in_progress";
        inProgressRequiredCount++;
      } else {
        requiredSectionsStatus[reqType] = "draft";
      }
    }
  }

  // Completeness score:
  // - 100% only if every required section is complete
  // - If any required section is incomplete or missing, score is strictly < 100%
  let score = 0;
  if (completedRequiredCount === totalRequired) {
    score = 100;
  } else {
    const weightPerReq = 100 / totalRequired;
    const raw =
      completedRequiredCount * weightPerReq + inProgressRequiredCount * (weightPerReq * 0.4);
    score = Math.min(99, Math.round(raw));
  }

  return {
    score,
    drafted: completedRequiredCount + inProgressRequiredCount,
    completed: completedRequiredCount,
    total: totalRequired,
    hasEvidenceGaps,
    requiredSectionsStatus,
  };
}
