import { describe, it, expect } from "vitest";
import {
  computeProposalCompleteness,
  REQUIRED_PROPOSAL_SECTION_TYPES,
  type ProposalSectionItem,
} from "./proposal-calc";

describe("Proposal Completeness Calculation", () => {
  const completeExecutiveSummary: ProposalSectionItem = {
    section_type: "executive_summary",
    completeness_status: "complete",
    content:
      "This executive summary outlines our comprehensive solution to the client's procurement requirements, detailing our methodology, compliance matrix, and executive leadership team commitments.",
  };

  const completeTechnicalApproach: ProposalSectionItem = {
    section_type: "technical_approach",
    completeness_status: "complete",
    content:
      "Our technical approach leverages modern automated workflows, strict quality gates, and verified architectural standards to deliver the requested deliverables ahead of schedule.",
  };

  const completeFinancialProposal: ProposalSectionItem = {
    section_type: "financial_proposal",
    completeness_status: "complete",
    content:
      "Our financial proposal provides a transparent, fixed-price commercial schedule with all applicable taxes, milestones, and deliverable acceptance criteria clearly defined.",
  };

  // 1. Empty proposal = 0%
  it("returns exactly 0% for an empty proposal", () => {
    const result = computeProposalCompleteness([]);
    expect(result.score).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.total).toBe(3);
    expect(result.hasEvidenceGaps).toBe(false);
    expect(result.requiredSectionsStatus.executive_summary).toBe("missing");
    expect(result.requiredSectionsStatus.technical_approach).toBe("missing");
    expect(result.requiredSectionsStatus.financial_proposal).toBe("missing");
  });

  // 2. All required sections complete = 100%
  it("returns exactly 100% when all required sections are complete", () => {
    const sections: ProposalSectionItem[] = [
      completeExecutiveSummary,
      completeTechnicalApproach,
      completeFinancialProposal,
    ];

    const result = computeProposalCompleteness(sections);
    expect(result.score).toBe(100);
    expect(result.completed).toBe(3);
    expect(result.total).toBe(3);
    expect(result.requiredSectionsStatus.executive_summary).toBe("complete");
    expect(result.requiredSectionsStatus.technical_approach).toBe("complete");
    expect(result.requiredSectionsStatus.financial_proposal).toBe("complete");
  });

  // 3. One required section incomplete < 100%
  it("returns strictly below 100% when one required section is incomplete or draft", () => {
    const incompleteTechnical: ProposalSectionItem = {
      section_type: "technical_approach",
      completeness_status: "in_progress",
      content: "Brief draft outline...",
    };

    const sections: ProposalSectionItem[] = [
      completeExecutiveSummary,
      incompleteTechnical,
      completeFinancialProposal,
    ];

    const result = computeProposalCompleteness(sections);
    expect(result.score).toBeLessThan(100);
    expect(result.completed).toBe(2);
    expect(result.requiredSectionsStatus.technical_approach).toBe("in_progress");
  });

  // 4. One required section missing < 100%
  it("returns strictly below 100% when one required section is completely missing", () => {
    const sections: ProposalSectionItem[] = [completeExecutiveSummary, completeFinancialProposal];

    const result = computeProposalCompleteness(sections);
    expect(result.score).toBeLessThan(100);
    expect(result.completed).toBe(2);
    expect(result.requiredSectionsStatus.technical_approach).toBe("missing");
  });

  // 5. Optional section missing can still equal 100%
  it("allows 100% completeness even when optional sections are missing", () => {
    // Only the 3 required sections exist; optional sections (e.g. team_and_cvs, deliverables) are missing
    const sections: ProposalSectionItem[] = [
      completeExecutiveSummary,
      completeTechnicalApproach,
      completeFinancialProposal,
    ];

    const result = computeProposalCompleteness(sections);
    expect(result.score).toBe(100);
  });

  // 6. Duplicate section type does NOT inflate score
  it("does not allow duplicate sections of the same type to inflate completeness", () => {
    // Two technical approaches, but executive summary and financial proposal are missing
    const duplicateTechnical: ProposalSectionItem = {
      section_type: "technical_approach",
      completeness_status: "complete",
      content:
        "Duplicate technical section describing additional infrastructure capabilities and implementation phases in depth.",
    };

    const sections: ProposalSectionItem[] = [completeTechnicalApproach, duplicateTechnical];

    const result = computeProposalCompleteness(sections);
    // Should only count as 1 required section complete out of 3 (33%), never inflated
    expect(result.score).toBeLessThan(50);
    expect(result.completed).toBe(1);
    expect(result.requiredSectionsStatus.technical_approach).toBe("complete");
    expect(result.requiredSectionsStatus.executive_summary).toBe("missing");
    expect(result.requiredSectionsStatus.financial_proposal).toBe("missing");
  });

  // 7. Evidence gap prevents 100%
  it("flags evidence gaps and prevents section completion if unresolved evidence tag is present", () => {
    const sectionWithGap: ProposalSectionItem = {
      section_type: "technical_approach",
      completeness_status: "complete",
      content:
        "We possess full ISO 27001 accreditation [Evidence required: ISO 27001 Certificate] and tier 3 datacenter availability.",
    };

    const sections: ProposalSectionItem[] = [
      completeExecutiveSummary,
      sectionWithGap,
      completeFinancialProposal,
    ];

    const result = computeProposalCompleteness(sections);
    expect(result.hasEvidenceGaps).toBe(true);
    expect(result.score).toBeLessThan(100);
    expect(result.requiredSectionsStatus.technical_approach).not.toBe("complete");
  });
});
