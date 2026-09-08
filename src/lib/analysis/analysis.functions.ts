/**
 * Authenticated RPC surface for the bid-intelligence pipeline.
 * The browser can only ask for an opportunity it can already see under RLS.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const analyzeInput = z.object({
  opportunityId: z.string().uuid(),
  force: z.boolean().optional(),
});

export const analyzeOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => analyzeInput.parse(data))
  .handler(async ({ data, context }) => {
    // 1. Resolve workspace_id for opportunity to verify entitlement
    const { data: opp, error: oppErr } = await context.supabase
      .from("opportunities")
      .select("workspace_id")
      .eq("id", data.opportunityId)
      .single();

    if (oppErr || !opp) {
      throw new Error("Opportunity not found or unauthorized.");
    }

    const { canAnalyzeTender, recordAnalysisUsage } = await import("../billing/entitlements.server");
    const { allowed, reason } = await canAnalyzeTender(context.supabase, opp.workspace_id);
    if (!allowed) {
      throw new Error(reason || "Tender analysis entitlement exceeded. Please upgrade your plan.");
    }

    const { runOpportunityAnalysis } = await import("./pipeline.server");
    const result = await runOpportunityAnalysis({
      supabase: context.supabase,
      userId: context.userId,
      opportunityId: data.opportunityId,
      force: data.force ?? false,
    });

    if (result && result.ok) {
      await recordAnalysisUsage(context.supabase, opp.workspace_id, data.opportunityId, context.userId);
    }

    return result;
  });

export const getAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ opportunityId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: analysis, error } = await context.supabase
      .from("opportunity_analyses")
      .select("*")
      .eq("opportunity_id", data.opportunityId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!analysis) return { analysis: null, components: [] };

    const { data: components, error: compError } = await context.supabase
      .from("score_components")
      .select("*")
      .eq("analysis_id", analysis.id);
    if (compError) throw new Error(compError.message);

    return { analysis, components: components ?? [] };
  });
