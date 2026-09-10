/**
 * Submissions Server — Package builder, readiness verification, and submission recording.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendSubmissionConfirmationEmail } from "../email/resend.server";

export type Client = SupabaseClient<Database>;
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

export async function getOrCreateBidWorkspace(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
  userId?: string | null,
): Promise<string> {
  const { data: existing } = await supabase
    .from("bid_workspaces")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("bid_workspaces")
    .insert({
      workspace_id: workspaceId,
      opportunity_id: opportunityId,
      owner_id: userId ?? null,
      status: "preparing",
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Failed to initialize bid workspace: ${error?.message}`);
  }
  return created.id;
}

/** Check if a bid is ready to submit */
export async function checkSubmissionReadiness(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
): Promise<SubmissionReadiness> {
  const bidWorkspaceId = await getOrCreateBidWorkspace(supabase, workspaceId, opportunityId);

  const [{ data: opp }, { data: proposalDocs }, { data: latestAudit }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("deadline, title")
      .eq("id", opportunityId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("proposal_documents")
      .select("id, completeness_status")
      .eq("bid_workspace_id", bidWorkspaceId)
      .eq("workspace_id", workspaceId),
    supabase
      .from("compliance_audits")
      .select("id, readiness_score")
      .eq("bid_workspace_id", bidWorkspaceId)
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let criticalFindings = 0;
  let openFindings = 0;

  if (latestAudit?.id) {
    const { data: findings } = await supabase
      .from("compliance_findings")
      .select("severity, status")
      .eq("audit_id", latestAudit.id)
      .eq("workspace_id", workspaceId);

    criticalFindings = (findings ?? []).filter(
      (f) => f.severity === "critical" && f.status === "open",
    ).length;
    openFindings = (findings ?? []).filter((f) => f.status === "open").length;
  }

  const proposalSections = proposalDocs?.length ?? 0;
  const completeSections = (proposalDocs ?? []).filter(
    (s) => s.completeness_status === "complete",
  ).length;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (proposalSections === 0) {
    blockers.push("No proposal sections have been drafted yet.");
  } else if (completeSections === 0) {
    blockers.push("No proposal sections have been marked as complete.");
  }

  if (criticalFindings > 0) {
    blockers.push(
      `${criticalFindings} critical compliance finding${criticalFindings > 1 ? "s" : ""} must be resolved before submission.`,
    );
  }

  if (!latestAudit) {
    warnings.push("No compliance audit has been run. Run an audit before submitting.");
  } else if (openFindings > 0) {
    warnings.push(`${openFindings} open compliance finding${openFindings > 1 ? "s" : ""} remain.`);
  }

  const hasSubmissionDeadline = !!opp?.deadline;
  let deadlineText: string | null = null;
  if (opp?.deadline) {
    const dl = new Date(opp.deadline);
    const msLeft = dl.getTime() - Date.now();
    const daysLeft = Math.ceil(msLeft / 86400000);
    deadlineText =
      daysLeft > 0 ? `Deadline in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}` : "Deadline passed";
    if (daysLeft <= 3 && daysLeft > 0) {
      warnings.push(`Submission deadline is in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}!`);
    }
  }

  return {
    isReady: blockers.length === 0,
    blockers,
    warnings,
    proposalSections,
    criticalFindings,
    openFindings,
    hasSubmissionDeadline,
    deadlineText,
  };
}

/** Record a confirmed submission */
export async function recordSubmission(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
  actorId: string,
  submissionData: {
    submission_method: string;
    confirmation_number?: string;
    notes?: string;
    submitted_at?: string;
    bid_price?: number;
    currency?: string;
  },
): Promise<{ id: string }> {
  const bidWorkspaceId = await getOrCreateBidWorkspace(
    supabase,
    workspaceId,
    opportunityId,
    actorId,
  );

  // Check if a submission record already exists for this bid_workspace
  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("bid_workspace_id", bidWorkspaceId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("submissions")
      .update({
        submission_owner_id: actorId,
        submission_method: submissionData.submission_method,
        status: "submitted",
        submitted_at: submissionData.submitted_at || new Date().toISOString(),
        notes: submissionData.notes || null,
        reference_number: submissionData.confirmation_number || null,
        bid_price: submissionData.bid_price ?? null,
        currency: submissionData.currency ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error || !data) throw new Error(`Failed to update submission: ${error?.message}`);
    
    await emitSubmissionNotifications({
      supabase,
      workspaceId,
      opportunityId,
      actorId,
      submittedAt: submissionData.submitted_at || new Date().toISOString(),
      confirmationNumber: submissionData.confirmation_number,
    });

    return { id: data.id };
  } else {
    const { data, error } = await supabase
      .from("submissions")
      .insert({
        workspace_id: workspaceId,
        bid_workspace_id: bidWorkspaceId,
        submission_owner_id: actorId,
        submission_method: submissionData.submission_method,
        status: "submitted",
        submitted_at: submissionData.submitted_at || new Date().toISOString(),
        notes: submissionData.notes || null,
        reference_number: submissionData.confirmation_number || null,
        bid_price: submissionData.bid_price ?? null,
        currency: submissionData.currency ?? null,
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(`Failed to record submission: ${error?.message}`);

    await emitSubmissionNotifications({
      supabase,
      workspaceId,
      opportunityId,
      actorId,
      submittedAt: submissionData.submitted_at || new Date().toISOString(),
      confirmationNumber: submissionData.confirmation_number,
    });

    return { id: data.id };
  }
}

async function emitSubmissionNotifications(params: {
  supabase: Client;
  workspaceId: string;
  opportunityId: string;
  actorId: string;
  submittedAt: string;
  confirmationNumber?: string | undefined;
}) {
  const { supabase, workspaceId, opportunityId, actorId, submittedAt, confirmationNumber } = params;

  try {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("title")
      .eq("id", opportunityId)
      .maybeSingle();

    const tenderTitle = opp?.title || "Tender Proposal";
    const formattedDate = new Date(submittedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // In-app notification
    await supabase.from("notifications").insert({
      workspace_id: workspaceId,
      user_id: actorId,
      kind: "submission_recorded",
      title: `Submission Logged: ${tenderTitle}`,
      body: `Formal proposal submission recorded on ${formattedDate}.`,
      link: `/tenders/${opportunityId}/workspace`,
    });

    // Email notification
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", actorId)
      .maybeSingle();

    if (profile?.email) {
      const siteUrl = process.env["APP_URL"] || "https://getbidradar.com";
      await sendSubmissionConfirmationEmail({
        to: profile.email,
        tenderTitle,
        submissionDate: formattedDate,
        ...(confirmationNumber ? { referenceNumber: confirmationNumber } : {}),
        url: `${siteUrl}/tenders/${opportunityId}/workspace`,
      });
    }
  } catch (err) {
    console.warn("[Submissions] Notification emission warning:", err);
  }
}

export async function getSubmission(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
): Promise<SubmissionRecord | null> {
  const { data: bw } = await supabase
    .from("bid_workspaces")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (!bw) return null;

  const { data } = await supabase
    .from("submissions")
    .select("*")
    .eq("bid_workspace_id", bw.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return data ?? null;
}
