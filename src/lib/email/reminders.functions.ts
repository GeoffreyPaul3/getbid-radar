import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkAndSendDeadlineReminders } from "./deadline-reminders.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const triggerDeadlineRemindersFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        cronSecret: z.string().optional(),
        workspaceId: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const expectedSecret = process.env["CRON_SECRET"];
    if (expectedSecret && data.cronSecret !== expectedSecret) {
      throw new Error("Unauthorized cron execution: invalid cronSecret.");
    }

    const summary = await checkAndSendDeadlineReminders(
      supabaseAdmin,
      data.workspaceId
    );

    return { ok: true, summary };
  });
