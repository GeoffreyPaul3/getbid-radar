import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { workspaceSearch } from "./search.server";

export const workspaceSearchFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        query: z.string().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return workspaceSearch(context.supabase, data.workspaceId, data.query);
  });
