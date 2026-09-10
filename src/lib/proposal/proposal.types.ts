import type { Database } from "@/integrations/supabase/types";

export type ProposalDocRecord = Database["public"]["Tables"]["proposal_documents"]["Row"];

export const PROPOSAL_SECTION_TYPES = [
  "executive_summary",
  "understanding_of_requirements",
  "company_profile",
  "technical_approach",
  "methodology",
  "work_plan",
  "team_and_cvs",
  "relevant_experience",
  "case_studies",
  "deliverables",
  "timeline",
  "risk_management",
  "quality_assurance",
  "financial_proposal",
  "compliance_statements",
  "references",
  "additional_information",
  "custom",
] as const;

export type ProposalSectionType = (typeof PROPOSAL_SECTION_TYPES)[number];

export {
  REQUIRED_PROPOSAL_SECTION_TYPES,
  type RequiredProposalSectionType,
  type ProposalSectionItem,
  type ProposalCompletenessResult,
  isSectionComplete,
  isSectionInProgress,
  deriveCompleteness,
  computeProposalCompleteness,
} from "./proposal-calc";
