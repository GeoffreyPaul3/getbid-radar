import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  type PlanTier,
  type PlanConfig,
  type WorkspaceBillingContext,
  getPlanConfig,
  isPlanTier,
} from "./plans";

export type Client = SupabaseClient<Database>;
export type { WorkspaceBillingContext };

export async function getWorkspaceBillingContext(
  supabase: Client,
  workspaceId: string,
): Promise<WorkspaceBillingContext> {
  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .select("id, plan, subscription_status, trial_ends_at, created_at")
    .eq("id", workspaceId)
    .single();

  if (wsErr || !ws) {
    throw new Error(`Workspace not found or unauthorized: ${workspaceId}`);
  }

  const rawPlan = ws.plan;
  const plan: PlanTier = isPlanTier(rawPlan) ? rawPlan : "trial";
  const planConfig = getPlanConfig(plan);
  const subscriptionStatus = ws.subscription_status || "trialing";
  const now = new Date();

  let isTrialExpired = false;
  if (plan === "trial" && ws.trial_ends_at) {
    isTrialExpired = now.getTime() > new Date(ws.trial_ends_at).getTime();
  }

  // Determine usage window:
  // For trial workspaces: usage is measured over the lifetime of the trial (from workspace creation)
  // For active monthly plans: usage is measured for the current UTC calendar month
  let periodStart: string;
  if (plan === "trial") {
    periodStart = ws.created_at || new Date(now.getTime() - 14 * 86400000).toISOString();
  } else {
    periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }

  const { data: usageRecords, error: usageErr } = await supabase
    .from("usage_records")
    .select("units")
    .eq("workspace_id", workspaceId)
    .eq("operation", "tender_analysis")
    .gte("created_at", periodStart);

  if (usageErr) {
    console.error("[Entitlements] Failed to fetch usage records:", usageErr.message);
  }

  const analysesUsed = (usageRecords ?? []).reduce(
    (acc, row) => acc + (typeof row.units === "number" ? row.units : 1),
    0,
  );

  const allowance = planConfig.analysisAllowance;
  const isUnlimited = allowance === -1;
  const remainingAnalyses = isUnlimited ? null : Math.max(0, allowance - analysesUsed);

  let canAnalyze = true;
  let blockReason: WorkspaceBillingContext["blockReason"] = null;

  if (plan === "trial") {
    if (isTrialExpired) {
      canAnalyze = false;
      blockReason = "TRIAL_EXPIRED";
    } else if (!isUnlimited && analysesUsed >= allowance) {
      canAnalyze = false;
      blockReason = "ALLOWANCE_EXCEEDED";
    }
  } else {
    if (subscriptionStatus === "past_due" || subscriptionStatus === "canceled") {
      canAnalyze = false;
      blockReason = "SUBSCRIPTION_INACTIVE";
    } else if (!isUnlimited && analysesUsed >= allowance) {
      canAnalyze = false;
      blockReason = "ALLOWANCE_EXCEEDED";
    }
  }

  return {
    workspaceId,
    plan,
    planConfig,
    subscriptionStatus,
    trialEndsAt: ws.trial_ends_at,
    isTrialExpired,
    analysesUsed,
    analysesAllowance: allowance,
    remainingAnalyses,
    canAnalyze,
    blockReason,
    periodStart,
  };
}

export async function canAnalyzeTender(
  supabase: Client,
  workspaceId: string,
): Promise<{ allowed: boolean; reason?: string; context: WorkspaceBillingContext }> {
  const context = await getWorkspaceBillingContext(supabase, workspaceId);

  if (!context.canAnalyze) {
    let message = "Analysis limit reached. Upgrade to continue.";
    if (context.blockReason === "TRIAL_EXPIRED") {
      message =
        "Your 14-day evaluation has expired. Please select a commercial plan to continue qualifying tenders.";
    } else if (context.blockReason === "ALLOWANCE_EXCEEDED") {
      message = `You have utilized all ${context.analysesAllowance} analyses included in your ${context.planConfig.name} plan for this billing period. Upgrade your plan for additional capacity.`;
    } else if (context.blockReason === "SUBSCRIPTION_INACTIVE") {
      message =
        "Your subscription is inactive or past due. Please update payment to resume tender analysis.";
    }
    return {
      allowed: false,
      reason: message,
      context,
    };
  }

  return {
    allowed: true,
    context,
  };
}

/**
 * Idempotently records a billable analysis execution.
 * If a record for this opportunityId and workspace already exists within the current billing period,
 * no duplicate usage record is inserted.
 */
export async function recordAnalysisUsage(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
  actorId?: string | null,
): Promise<{ recorded: boolean; reason?: string }> {
  // Check for existing usage record for this specific resource to maintain strict idempotency
  const { data: existing } = await supabase
    .from("usage_records")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("operation", "tender_analysis")
    .eq("resource_id", opportunityId)
    .limit(1);

  if (existing && existing.length > 0) {
    return { recorded: false, reason: "ALREADY_METERED" };
  }

  const { error: insertErr } = await supabase.from("usage_records").insert({
    workspace_id: workspaceId,
    actor_id: actorId ?? null,
    operation: "tender_analysis",
    resource_id: opportunityId,
    units: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      opportunity_id: opportunityId,
    },
  });

  if (insertErr) {
    console.error("[Entitlements] Error inserting usage record:", insertErr.message);
    throw new Error(`Failed to record analysis usage: ${insertErr.message}`);
  }

  // Also log to activity_logs for audit trail
  try {
    await supabase.from("activity_logs").insert({
      workspace_id: workspaceId,
      actor_id: actorId ?? null,
      action: "tender_analyzed",
      resource_type: "opportunity",
      resource_id: opportunityId,
      metadata: {
        operation: "tender_analysis",
        units: 1,
      },
    });
  } catch (logErr) {
    console.warn("[Entitlements] Could not write activity log:", logErr);
  }

  return { recorded: true };
}
