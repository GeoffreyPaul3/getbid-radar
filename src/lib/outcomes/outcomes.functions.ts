import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  recordBidOutcome,
  getLearningInsights,
  getBidOutcome,
  type RecordOutcomeInput,
  type BidOutcomeRecord,
} from "./outcomes.server";

export const recordBidOutcomeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        opportunityId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        status: z.enum(["won", "lost", "cancelled", "disqualified"]),
        winning_company: z.string().optional(),
        winning_price: z.number().positive().optional(),
        our_bid_price: z.number().positive().optional(),
        evaluation_score: z.number().min(0).max(100).optional(),
        buyer_feedback: z.string().max(2000).optional(),
        loss_reason: z.string().max(500).optional(),
        disqualification_reason: z.string().max(500).optional(),
        lessons_learned: z.string().max(3000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const input: RecordOutcomeInput = {
      opportunityId: data.opportunityId,
      status: data.status,
    };
    if (data.winning_company !== undefined) input.winning_company = data.winning_company;
    if (data.winning_price !== undefined) input.winning_price = data.winning_price;
    if (data.our_bid_price !== undefined) input.our_bid_price = data.our_bid_price;
    if (data.evaluation_score !== undefined) input.evaluation_score = data.evaluation_score;
    if (data.buyer_feedback !== undefined) input.buyer_feedback = data.buyer_feedback;
    if (data.loss_reason !== undefined) input.loss_reason = data.loss_reason;
    if (data.disqualification_reason !== undefined)
      input.disqualification_reason = data.disqualification_reason;
    if (data.lessons_learned !== undefined) input.lessons_learned = data.lessons_learned;

    return recordBidOutcome(context.supabase, data.workspaceId, context.userId, input);
  });

export const getLearningInsightsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return getLearningInsights(context.supabase, data.workspaceId);
  });

export const getBidOutcomeFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ opportunityId: z.string().uuid(), workspaceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<BidOutcomeRecord | null> => {
    return getBidOutcome(context.supabase, data.workspaceId, data.opportunityId);
  });
