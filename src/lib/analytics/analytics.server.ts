/**
 * Analytics Server — Real workspace performance metrics.
 * Zero fake data. Useful empty states when no bids or outcomes exist.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Client = SupabaseClient<Database>;

export interface WorkspaceAnalytics {
  // Opportunity pipeline
  totalOpportunities: number;
  analysisComplete: number;
  biddingActive: number;
  noBidDecisions: number;
  reviewDecisions: number;
  bidDecisions: number;
  averageQualificationScore: number | null;

  // Bid execution
  activeBids: number;
  submittedBids: number;
  wonBids: number;
  lostBids: number;
  cancelledBids: number;

  // Win analytics
  winRate: number;
  winRateByCategory: Array<{ category: string; won: number; total: number; rate: number }>;

  // Operational
  overdueTaskCount: number;
  openComplianceIssues: number;
  averagePreparationDays: number | null;

  // Time-series (last 12 months)
  opportunityTrend: Array<{ month: string; count: number }>;
}

export async function getWorkspaceAnalytics(
  supabase: Client,
  workspaceId: string,
): Promise<WorkspaceAnalytics> {
  const [
    { data: opportunities },
    { data: analyses },
    { data: bidWorkspaces },
    { data: outcomes },
    { data: tasks },
    { data: complianceFindings },
    { data: submissions },
  ] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, title, category, status, created_at")
      .eq("workspace_id", workspaceId),
    supabase
      .from("opportunity_analyses")
      .select("opportunity_id, recommendation, bidradar_score")
      .eq("workspace_id", workspaceId),
    supabase
      .from("bid_workspaces")
      .select("id, opportunity_id, status")
      .eq("workspace_id", workspaceId),
    supabase.from("bid_outcomes").select("result, opportunity_id").eq("workspace_id", workspaceId),
    supabase.from("bid_tasks").select("id, status, due_date").eq("workspace_id", workspaceId),
    supabase
      .from("compliance_findings")
      .select("id, status, severity")
      .eq("workspace_id", workspaceId),
    supabase
      .from("submissions")
      .select("id, bid_workspace_id, submitted_at, created_at")
      .eq("workspace_id", workspaceId),
  ]);

  const opps = opportunities ?? [];
  const anals = analyses ?? [];
  const bws = bidWorkspaces ?? [];
  const outs = outcomes ?? [];

  // Map opportunity_id to latest analysis
  const oppAnalysisMap = new Map<string, { recommendation: string | null; score: number | null }>();
  for (const a of anals) {
    oppAnalysisMap.set(a.opportunity_id, {
      recommendation: a.recommendation,
      score: a.bidradar_score,
    });
  }

  // Opportunity analytics
  let analysisComplete = 0;
  let bidDecisions = 0;
  let noBidDecisions = 0;
  let reviewDecisions = 0;
  const scores: number[] = [];

  for (const opp of opps) {
    const analysis = oppAnalysisMap.get(opp.id);
    if (analysis && analysis.recommendation) {
      analysisComplete++;
      const rec = analysis.recommendation.toLowerCase();
      if (rec === "bid") bidDecisions++;
      else if (rec === "no_bid") noBidDecisions++;
      else if (rec === "review") reviewDecisions++;

      if (typeof analysis.score === "number" && analysis.score > 0) {
        scores.push(analysis.score);
      }
    }
  }

  const averageQualificationScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  // Bid execution & active bidding
  const activeBids = bws.filter(
    (b) =>
      b.status === "preparing" || b.status === "ready_for_review" || b.status === "ready_to_submit",
  ).length;
  const biddingActive = activeBids;

  // Bid outcomes
  const wonBids = outs.filter((o) => o.result === "won").length;
  const lostBids = outs.filter((o) => o.result === "lost").length;
  const cancelledBids = outs.filter((o) => o.result === "cancelled").length;
  const submittedBids = (submissions ?? []).length;
  const totalWithOutcome = wonBids + lostBids;
  const winRate = totalWithOutcome > 0 ? Math.round((wonBids / totalWithOutcome) * 100) : 0;

  // Win rate by category
  const categoryMap: Record<string, { won: number; total: number }> = {};
  for (const opp of opps) {
    const analysis = oppAnalysisMap.get(opp.id);
    if (analysis?.recommendation?.toLowerCase() === "bid") {
      const cat = opp.category || "General";
      if (!categoryMap[cat]) categoryMap[cat] = { won: 0, total: 0 };
      categoryMap[cat]!.total += 1;
      const outcome = outs.find((o) => o.opportunity_id === opp.id);
      if (outcome?.result === "won") categoryMap[cat]!.won += 1;
    }
  }

  const winRateByCategory = Object.entries(categoryMap)
    .filter(([, v]) => v.total > 0)
    .map(([category, { won, total }]) => ({
      category,
      won,
      total,
      rate: Math.round((won / total) * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Operational metrics
  const now = new Date();
  const overdueTaskCount = (tasks ?? []).filter(
    (t) => t.status !== "completed" && t.due_date && new Date(t.due_date) < now,
  ).length;
  const openComplianceIssues = (complianceFindings ?? []).filter(
    (f) => f.status === "open" && (f.severity === "critical" || f.severity === "high"),
  ).length;

  // Map bid_workspace_id -> opportunity_id
  const bwToOppMap = new Map<string, string>();
  for (const bw of bws) {
    bwToOppMap.set(bw.id, bw.opportunity_id);
  }

  // Average preparation days (opp created_at to submitted_at)
  const prepDays: number[] = [];
  for (const sub of submissions ?? []) {
    const oppId = bwToOppMap.get(sub.bid_workspace_id);
    const opp = oppId ? opps.find((o) => o.id === oppId) : undefined;
    if (opp && sub.submitted_at && opp.created_at) {
      const days =
        (new Date(sub.submitted_at).getTime() - new Date(opp.created_at).getTime()) / 86400000;
      if (days > 0) prepDays.push(Math.round(days));
    }
  }
  const averagePreparationDays =
    prepDays.length > 0 ? Math.round(prepDays.reduce((a, b) => a + b, 0) / prepDays.length) : null;

  // 12-month trend
  const trendMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    trendMap[key] = 0;
  }
  for (const opp of opps) {
    if (!opp.created_at) continue;
    const d = new Date(opp.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in trendMap) trendMap[key]! += 1;
  }
  const opportunityTrend = Object.entries(trendMap).map(([month, count]) => ({ month, count }));

  return {
    totalOpportunities: opps.length,
    analysisComplete,
    biddingActive,
    noBidDecisions,
    reviewDecisions,
    bidDecisions,
    averageQualificationScore,
    activeBids,
    submittedBids,
    wonBids,
    lostBids,
    cancelledBids,
    winRate,
    winRateByCategory,
    overdueTaskCount,
    openComplianceIssues,
    averagePreparationDays,
    opportunityTrend,
  };
}
