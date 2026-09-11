import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePlatformAdmin } from "./admin.middleware";
import { PLAN_CONFIGS, type PlanTier, isPlanTier } from "../billing/plans";

// ==========================================
// 1. Check Platform Admin Status
// ==========================================
export const checkPlatformAdminStatusFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ userId: z.string().min(1) }).parse(data)
  )
  .handler(async ({ data }): Promise<{ isPlatformAdmin: boolean }> => {
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("is_platform_admin")
        .eq("id", data.userId)
        .maybeSingle();

      return { isPlatformAdmin: Boolean(profile?.is_platform_admin) };
    } catch {
      return { isPlatformAdmin: false };
    }
  });

// ==========================================
// 2. Admin Overview Metrics
// ==========================================
export interface AdminOverviewMetrics {
  totalWorkspaces: number;
  totalUsers: number;
  totalOpportunities: number;
  totalSubmissions: number;
  activeTrials: number;
  estimatedMRR_USD: number;
  planDistribution: Record<string, number>;
  recentWorkspaces: Array<{
    id: string;
    name: string;
    plan: string;
    subscription_status: string;
    created_at: string;
  }>;
  recentTransactions: Array<{
    id: string;
    workspace_id: string;
    plan: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
  }>;
}

export const getAdminOverviewMetricsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ adminUserId: z.string().min(1) }).parse(data)
  )
  .handler(async ({ data }): Promise<AdminOverviewMetrics> => {
    await requirePlatformAdmin(data.adminUserId);

    const [
      { count: totalWorkspaces },
      { count: totalUsers },
      { count: totalOpportunities },
      { count: totalSubmissions },
      { data: workspacesData },
      { data: recentTxs },
    ] = await Promise.all([
      supabaseAdmin.from("workspaces").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("opportunities").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("workspaces")
        .select("id, name, plan, subscription_status, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("billing_transactions")
        .select("id, workspace_id, plan, amount, currency, status, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const allWorkspaces = workspacesData || [];
    const planDist: Record<string, number> = {
      trial: 0,
      starter: 0,
      growth: 0,
      pro: 0,
      enterprise: 0,
    };

    let activeTrials = 0;
    let estimatedMRR_USD = 0;

    for (const ws of allWorkspaces) {
      const p = ws.plan || "trial";
      planDist[p] = (planDist[p] || 0) + 1;

      if (p === "trial") {
        activeTrials++;
      } else if (isPlanTier(p) && ws.subscription_status === "active") {
        estimatedMRR_USD += PLAN_CONFIGS[p].monthlyPrice.USD;
      }
    }

    return {
      totalWorkspaces: totalWorkspaces || 0,
      totalUsers: totalUsers || 0,
      totalOpportunities: totalOpportunities || 0,
      totalSubmissions: totalSubmissions || 0,
      activeTrials,
      estimatedMRR_USD,
      planDistribution: planDist,
      recentWorkspaces: allWorkspaces.slice(0, 5),
      recentTransactions: (recentTxs as any) || [],
    };
  });

// ==========================================
// 3. Admin Companies Management
// ==========================================
export interface AdminCompanyRecord {
  id: string;
  name: string;
  plan: string;
  subscription_status: string;
  created_at: string;
  member_count: number;
  opportunity_count: number;
}

export const getAdminCompaniesFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ adminUserId: z.string().min(1) }).parse(data)
  )
  .handler(async ({ data }): Promise<AdminCompanyRecord[]> => {
    await requirePlatformAdmin(data.adminUserId);

    const { data: workspaces, error } = await supabaseAdmin
      .from("workspaces")
      .select(`
        id,
        name,
        plan,
        subscription_status,
        created_at,
        workspace_members(count),
        opportunities(count)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    return (workspaces || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      plan: w.plan || "trial",
      subscription_status: w.subscription_status || "trialing",
      created_at: w.created_at,
      member_count: w.workspace_members?.[0]?.count || 0,
      opportunity_count: w.opportunities?.[0]?.count || 0,
    }));
  });

export const updateCompanyPlanOverrideFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        adminUserId: z.string().min(1),
        workspaceId: z.string().min(1),
        plan: z.enum(["trial", "starter", "growth", "pro", "enterprise"]),
        subscriptionStatus: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    await requirePlatformAdmin(data.adminUserId);

    const { error } = await supabaseAdmin
      .from("workspaces")
      .update({
        plan: data.plan,
        subscription_status: data.subscriptionStatus || "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.workspaceId);

    if (error) {
      throw new Error(`Failed to update workspace plan: ${error.message}`);
    }

    return { success: true };
  });

// ==========================================
// 4. Admin Users Management
// ==========================================
export interface AdminUserRecord {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_platform_admin: boolean;
  created_at: string;
}

export const getAdminUsersFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ adminUserId: z.string().min(1) }).parse(data)
  )
  .handler(async ({ data }): Promise<AdminUserRecord[]> => {
    await requirePlatformAdmin(data.adminUserId);

    const { data: users, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, avatar_url, is_platform_admin, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return (users || []) as AdminUserRecord[];
  });

export const toggleUserAdminStatusFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        adminUserId: z.string().min(1),
        targetUserId: z.string().min(1),
        makeAdmin: z.boolean(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    await requirePlatformAdmin(data.adminUserId);

    // Prevent revoking oneself to avoid locking out the last admin
    if (data.adminUserId === data.targetUserId && !data.makeAdmin) {
      throw new Error("You cannot revoke your own platform administrator privileges.");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_platform_admin: data.makeAdmin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.targetUserId);

    if (error) {
      throw new Error(`Failed to update admin status: ${error.message}`);
    }

    return { success: true };
  });

// ==========================================
// 5. Admin Revenue & Transactions
// ==========================================
export interface AdminTransactionRecord {
  id: string;
  workspace_id: string;
  workspace_name?: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  tx_ref: string;
  created_at: string;
  activated_at?: string | null;
}

export const getAdminRevenueFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ adminUserId: z.string().min(1) }).parse(data)
  )
  .handler(async ({ data }): Promise<AdminTransactionRecord[]> => {
    await requirePlatformAdmin(data.adminUserId);

    const { data: txs, error } = await supabaseAdmin
      .from("billing_transactions")
      .select(`
        id,
        workspace_id,
        plan,
        amount,
        currency,
        status,
        tx_ref,
        created_at,
        activated_at,
        workspaces(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return (txs || []).map((t: any) => ({
      id: t.id,
      workspace_id: t.workspace_id,
      workspace_name: t.workspaces?.name || "Unknown Workspace",
      plan: t.plan,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      tx_ref: t.tx_ref,
      created_at: t.created_at,
      activated_at: t.activated_at,
    }));
  });

// ==========================================
// 6. Admin Platform Analytics
// ==========================================
export interface AdminAnalyticsData {
  opportunityStatusCounts: Record<string, number>;
  totalAudits: number;
  totalFindings: number;
  averageReadinessScore: number;
}

export const getAdminAnalyticsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ adminUserId: z.string().min(1) }).parse(data)
  )
  .handler(async ({ data }): Promise<AdminAnalyticsData> => {
    await requirePlatformAdmin(data.adminUserId);

    const [
      { data: opps },
      { data: audits },
      { count: totalFindings },
    ] = await Promise.all([
      supabaseAdmin.from("opportunities").select("status"),
      supabaseAdmin.from("compliance_audits").select("readiness_score"),
      supabaseAdmin.from("compliance_findings").select("id", { count: "exact", head: true }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const o of opps || []) {
      const s = o.status || "unreviewed";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    let avgScore = 0;
    if (audits && audits.length > 0) {
      const validScores = audits
        .map((a) => a.readiness_score)
        .filter((s): s is number => typeof s === "number");
      if (validScores.length > 0) {
        avgScore = Math.round(
          validScores.reduce((sum, val) => sum + val, 0) / validScores.length
        );
      }
    }

    return {
      opportunityStatusCounts: statusCounts,
      totalAudits: audits?.length || 0,
      totalFindings: totalFindings || 0,
      averageReadinessScore: avgScore,
    };
  });
