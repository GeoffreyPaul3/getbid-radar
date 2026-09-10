import type { Database } from "@/integrations/supabase/types";

export type FindingSeverity = Database["public"]["Enums"]["finding_severity"];
export type FindingStatus = "open" | "acknowledged" | "resolved" | "waived";
export type FindingCategory =
  | "mandatory_eligibility"
  | "submission_documents"
  | "evaluation_criteria"
  | "consistency_check"
  | "technical_compliance";

export interface ComplianceFinding {
  id?: string | undefined;
  severity: FindingSeverity;
  category: FindingCategory;
  status: FindingStatus;
  requirement?: string | undefined;
  problem: string;
  evidence?: string | undefined;
  recommended_fix: string;
  source_reference?: string | undefined;
}

export interface ComplianceAuditResult {
  auditId: string;
  version: number;
  readinessScore: number;
  readinessLabel: "READY" | "REVIEW" | "NOT_READY";
  findings: ComplianceFinding[];
  passedCount: number;
  openCount: number;
  criticalCount: number;
  highCount: number;
  ranAt: string;
}
