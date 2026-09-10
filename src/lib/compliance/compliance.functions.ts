/**
 * Compliance TanStack server functions (client-callable).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  runComplianceAudit,
  updateFindingStatus,
  getLatestAudit,
  type FindingStatus,
} from "./auditor.server";

export const runComplianceAuditFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ opportunityId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: opp } = await context.supabase
      .from("opportunities")
      .select("workspace_id")
      .eq("id", data.opportunityId)
      .single();
    if (!opp) throw new Error("Opportunity not found");
    return runComplianceAudit(context.supabase, opp.workspace_id, data.opportunityId);
  });

export const updateFindingStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        findingId: z.string().uuid(),
        status: z.enum(["open", "acknowledged", "resolved", "waived"]),
        workspaceId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await updateFindingStatus(
      context.supabase,
      data.workspaceId,
      data.findingId,
      data.status as FindingStatus,
    );
    return { success: true };
  });

export const getLatestAuditFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({ opportunityId: z.string().uuid(), workspaceId: z.string().uuid() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return getLatestAudit(context.supabase, data.workspaceId, data.opportunityId);
  });
