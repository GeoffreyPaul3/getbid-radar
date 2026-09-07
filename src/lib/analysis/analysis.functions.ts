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
  .inputValidator((data: unknown) => analyzeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { runOpportunityAnalysis } = await import("./pipeline.server");
    return runOpportunityAnalysis({
      supabase: context.supabase,
      userId: context.userId,
      opportunityId: data.opportunityId,
      force: data.force ?? false,
    });
  });

export const getAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ opportunityId: z.string().uuid() }).parse(data))
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
