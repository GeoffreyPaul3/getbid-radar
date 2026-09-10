import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getWorkspaceAnalytics } from "./analytics.server";

export const getWorkspaceAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return getWorkspaceAnalytics(context.supabase, data.workspaceId);
  });
