/**
 * Outcomes & Learning Intelligence Server
 * Schema: bid_outcomes(id, workspace_id, opportunity_id UNIQUE, result,
 *   winning_company, winning_price, our_price, evaluation_score,
 *   feedback, loss_reason, disqualification_reason, lessons_learned, recorded_by, recorded_at)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Client = SupabaseClient<Database>;
export type OutcomeResult = Database["public"]["Enums"]["outcome_result"];
export type BidOutcomeRecord = Database["public"]["Tables"]["bid_outcomes"]["Row"];

export interface RecordOutcomeInput {
  opportunityId: string;
  status: OutcomeResult;
  winning_company?: string;
  winning_price?: number;
  our_bid_price?: number;
  evaluation_score?: number;
  buyer_feedback?: string;
  loss_reason?: string;
  disqualification_reason?: string;
  lessons_learned?: string;
}

export async function recordBidOutcome(
  supabase: Client,
  workspaceId: string,
  actorId: string,
  input: RecordOutcomeInput,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("bid_outcomes")
    .upsert(
      {
        workspace_id: workspaceId,
        opportunity_id: input.opportunityId,
        result: input.status,
        winning_company: input.winning_company || null,
        winning_price: input.winning_price || null,
        our_price: input.our_bid_price || null,
        evaluation_score: input.evaluation_score || null,
        feedback: input.buyer_feedback || null,
        loss_reason: input.loss_reason || null,
        disqualification_reason: input.disqualification_reason || null,
        lessons_learned: input.lessons_learned || null,
        recorded_by: actorId,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "opportunity_id" },
    )
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to record bid outcome: ${error?.message}`);

  return { id: data.id };
}

export interface LearningInsights {
  totalBids: number;
  winCount: number;
  lossCount: number;
  cancelledCount: number;
  disqualifiedCount: number;
  winRate: number;
  averageBidValue: number | null;
  commonLossReasons: Array<{ reason: string; count: number }>;
  topCategories: Array<{ category: string; bids: number; wins: number; winRate: number }>;
  hasEnoughData: boolean;
  minimumDataMessage: string | null;
}

export async function getLearningInsights(
  supabase: Client,
  workspaceId: string,
): Promise<LearningInsights> {
  const MIN_BIDS_FOR_INSIGHTS = 3;

  const { data: outcomes } = await supabase
    .from("bid_outcomes")
    .select("result, our_price, loss_reason, opportunity_id")
    .eq("workspace_id", workspaceId);

  const totalBids = outcomes?.length ?? 0;

  if (totalBids < MIN_BIDS_FOR_INSIGHTS) {
    return {
      totalBids,
      winCount: 0,
      lossCount: 0,
      cancelledCount: 0,
      disqualifiedCount: 0,
      winRate: 0,
      averageBidValue: null,
      commonLossReasons: [],
      topCategories: [],
      hasEnoughData: false,
      minimumDataMessage: `Record outcomes for at least ${MIN_BIDS_FOR_INSIGHTS} bids to unlock learning insights (${totalBids}/${MIN_BIDS_FOR_INSIGHTS} recorded so far).`,
    };
  }

  const winCount = (outcomes ?? []).filter((o) => o.result === "won").length;
  const lossCount = (outcomes ?? []).filter((o) => o.result === "lost").length;
  const cancelledCount = (outcomes ?? []).filter((o) => o.result === "cancelled").length;
  const disqualifiedCount = (outcomes ?? []).filter((o) => o.result === "disqualified").length;
  const winRate = totalBids > 0 ? Math.round((winCount / totalBids) * 100) : 0;

  const bidValues = (outcomes ?? [])
    .map((o) => o.our_price)
    .filter((v): v is number => v != null && v > 0);
  const averageBidValue =
    bidValues.length > 0
      ? Math.round(bidValues.reduce((a, b) => a + b, 0) / bidValues.length)
      : null;

  const lossReasonCounts: Record<string, number> = {};
  for (const o of outcomes ?? []) {
    if (o.result === "lost" && o.loss_reason) {
      const r = o.loss_reason;
      lossReasonCounts[r] = (lossReasonCounts[r] ?? 0) + 1;
    }
  }
  const commonLossReasons = Object.entries(lossReasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const opportunityIds = (outcomes ?? [])
    .map((o) => o.opportunity_id)
    .filter((id): id is string => !!id);

  let topCategories: LearningInsights["topCategories"] = [];

  if (opportunityIds.length > 0) {
    const { data: opps } = await supabase
      .from("opportunities")
      .select("id, category")
      .in("id", opportunityIds);

    const categoryMap: Record<string, { bids: number; wins: number }> = {};
    for (const opp of opps ?? []) {
      const cat = opp.category || "General";
      if (!categoryMap[cat]) categoryMap[cat] = { bids: 0, wins: 0 };
      categoryMap[cat]!.bids += 1;
      const outcome = (outcomes ?? []).find((o) => o.opportunity_id === opp.id);
      if (outcome && outcome.result === "won") categoryMap[cat]!.wins += 1;
    }

    topCategories = Object.entries(categoryMap)
      .map(([category, { bids, wins }]) => ({
        category,
        bids,
        wins,
        winRate: bids > 0 ? Math.round((wins / bids) * 100) : 0,
      }))
      .sort((a, b) => b.bids - a.bids)
      .slice(0, 5);
  }

  return {
    totalBids,
    winCount,
    lossCount,
    cancelledCount,
    disqualifiedCount,
    winRate,
    averageBidValue,
    commonLossReasons,
    topCategories,
    hasEnoughData: true,
    minimumDataMessage: null,
  };
}

export async function getBidOutcome(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
): Promise<BidOutcomeRecord | null> {
  const { data } = await supabase
    .from("bid_outcomes")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return data ?? null;
}
