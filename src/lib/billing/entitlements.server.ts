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

/** Format a day count into a human countdown string. */
function countdownText(ms: number, prefix: string): string {
  if (ms <= 0) return `${prefix} expired`;
  const days = Math.ceil(ms / 86400000);
  if (days === 1) return `${prefix} tomorrow`;
  if (days <= 7) return `${prefix} in ${days} days`;
  if (days <= 30) return `${prefix} in ${days} days`;
  const months = Math.round(days / 30);
  return `${prefix} in ~${months} month${months !== 1 ? "s" : ""}`;
}

export async function getWorkspaceBillingContext(
  supabase: Client,
  workspaceId: string,
): Promise<WorkspaceBillingContext> {
  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .select(
      "id, plan, subscription_status, trial_ends_at, created_at, current_period_start, current_period_end, renewal_date",
    )
    .eq("id", workspaceId)
    .single();

  if (wsErr || !ws) {
    throw new Error(`Workspace not found or unauthorized: ${workspaceId}`);
  }

  const rawPlan = ws.plan;
  const plan: PlanTier = isPlanTier(rawPlan) ? rawPlan : "trial";
  const planConfig: PlanConfig = getPlanConfig(plan);
  const subscriptionStatus = ws.subscription_status || "trialing";
  const now = new Date();
  const isTrial = plan === "trial";

  // -----------------------------------------------------------------------
  // Determine the usage window
  // -----------------------------------------------------------------------
  // Trial: measure from workspace creation_at through trial_ends_at.
  //        Only usage records WHERE plan IS NULL OR plan = 'trial' are counted.
  // Paid:  measure strictly within current_period_start .. current_period_end
  //        as set by the payment activation (never from calendar months).
  //        If the period has rolled over but the DB hasn't been updated yet,
  //        advance the window deterministically without counting old records.

  let periodStart: string;
  let periodEnd: string | null = null;

  // Handle period rollover for paid plans: if we're past current_period_end,
  // the new period is implicitly in effect even if renewal hasn't been processed.
  let effectivePeriodStart = ws.current_period_start;
  let effectivePeriodEnd = ws.current_period_end;

  if (!isTrial && effectivePeriodEnd && now > new Date(effectivePeriodEnd)) {
    // Roll the period forward by 30-day increments until now is within window
    let ps = new Date(ws.current_period_start ?? ws.created_at!);
    let pe = new Date(effectivePeriodEnd);
    while (now >= pe) {
      ps = pe;
      pe = new Date(pe.getTime() + 30 * 86400000);
    }
    effectivePeriodStart = ps.toISOString();
    effectivePeriodEnd = pe.toISOString();
  }

  if (isTrial) {
    periodStart = ws.created_at || new Date(now.getTime() - 14 * 86400000).toISOString();
    periodEnd = ws.trial_ends_at || null;
  } else {
    periodStart =
      effectivePeriodStart ||
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    periodEnd = effectivePeriodEnd || null;
  }

  // -----------------------------------------------------------------------
  // Query usage records for the current window
  // -----------------------------------------------------------------------
  let usageQuery = supabase
    .from("usage_records")
    .select("units")
    .eq("workspace_id", workspaceId)
    .eq("operation", "tender_analysis")
    .gte("created_at", periodStart);

  if (periodEnd) {
    usageQuery = usageQuery.lt("created_at", periodEnd);
  }

  // For paid plans: exclude records tagged as trial to prevent bleed-over
  if (!isTrial) {
    usageQuery = usageQuery.not("plan", "eq", "trial");
  }

  const { data: usageRecords, error: usageErr } = await usageQuery;

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

  // Trial expiry check
  let isTrialExpired = false;
  if (isTrial && ws.trial_ends_at) {
    isTrialExpired = now.getTime() > new Date(ws.trial_ends_at).getTime();
  }

  if (isTrial) {
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

  // -----------------------------------------------------------------------
  // Countdown text
  // -----------------------------------------------------------------------
  let countdown = "";
  if (isTrial && periodEnd) {
    countdown = countdownText(new Date(periodEnd).getTime() - now.getTime(), "Trial ends");
  } else if (!isTrial && (effectivePeriodEnd || ws.renewal_date)) {
    const end = effectivePeriodEnd || ws.renewal_date;
    countdown = countdownText(new Date(end!).getTime() - now.getTime(), "Renews");
  } else {
    countdown = "Subscription active";
  }

  return {
    workspaceId,
    plan,
    planConfig,
    subscriptionStatus,
    trialEndsAt: ws.trial_ends_at,
    isTrialExpired,
    isTrial,
    analysesUsed,
    analysesAllowance: allowance,
    remainingAnalyses,
    canAnalyze,
    blockReason,
    periodStart,
    periodEnd,
    currentPeriodStart: effectivePeriodStart,
    currentPeriodEnd: effectivePeriodEnd,
    renewalDate: ws.renewal_date,
    countdownText: countdown,
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
    return { allowed: false, reason: message, context };
  }

  return { allowed: true, context };
}

/**
 * Idempotently records a billable analysis execution.
 * Tags the record with the current plan and billing period so it can
 * be accurately filtered during entitlement checks.
 */
export async function recordAnalysisUsage(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
  actorId?: string | null,
): Promise<{ recorded: boolean; reason?: string }> {
  // Strict idempotency — one record per opportunity per workspace
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

  // Get current period info for tagging
  let currentPeriodStart: string | null = null;
  let currentPeriodEnd: string | null = null;
  let currentPlan: string = "trial";
  try {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("plan, current_period_start, current_period_end")
      .eq("id", workspaceId)
      .single();
    if (ws) {
      currentPlan = ws.plan || "trial";
      currentPeriodStart = ws.current_period_start;
      currentPeriodEnd = ws.current_period_end;
    }
  } catch {
    // non-fatal; just tag as trial
  }

  const { error: insertErr } = await supabase.from("usage_records").insert({
    workspace_id: workspaceId,
    actor_id: actorId ?? null,
    operation: "tender_analysis",
    resource_id: opportunityId,
    units: 1,
    plan: currentPlan,
    period_start: currentPeriodStart,
    period_end: currentPeriodEnd,
    metadata: {
      timestamp: new Date().toISOString(),
      opportunity_id: opportunityId,
    },
  });

  if (insertErr) {
    console.error("[Entitlements] Error inserting usage record:", insertErr.message);
    throw new Error(`Failed to record analysis usage: ${insertErr.message}`);
  }

  // Audit trail
  try {
    await supabase.from("activity_logs").insert({
      workspace_id: workspaceId,
      actor_id: actorId ?? null,
      action: "tender_analyzed",
      resource_type: "opportunity",
      resource_id: opportunityId,
      metadata: { operation: "tender_analysis", units: 1, plan: currentPlan },
    });
  } catch (logErr) {
    console.warn("[Entitlements] Could not write activity log:", logErr);
  }

  return { recorded: true };
}
