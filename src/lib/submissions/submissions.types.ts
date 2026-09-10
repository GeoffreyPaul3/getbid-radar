import type { Database } from "@/integrations/supabase/types";

export type SubmissionRecord = Database["public"]["Tables"]["submissions"]["Row"];

export type SubmissionStatus =
  "preparing" | "ready_for_review" | "ready_to_submit" | "submitted" | "withdrawn";

export interface SubmissionReadiness {
  isReady: boolean;
  blockers: string[];
  warnings: string[];
  proposalSections: number;
  criticalFindings: number;
  openFindings: number;
  hasSubmissionDeadline: boolean;
  deadlineText: string | null;
}
