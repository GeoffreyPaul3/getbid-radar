import type { Database } from "@/integrations/supabase/types";

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
