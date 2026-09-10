import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendDeadlineReminderEmail } from "./resend.server";

export type Client = SupabaseClient<Database>;

export interface ReminderRunSummary {
  checkedOpportunities: number;
  remindersSent: number;
  errors: string[];
}

/**
 * Checks all active opportunities (status 'pursuing' or 'preparing') with deadlines,
 * and sends 7-day, 3-day, or 24-hour reminder emails idempotently.
 */
export async function checkAndSendDeadlineReminders(
  supabase: Client,
  targetWorkspaceId?: string
): Promise<ReminderRunSummary> {
  const summary: ReminderRunSummary = {
    checkedOpportunities: 0,
    remindersSent: 0,
    errors: [],
  };

  const now = new Date();
  const nowMs = now.getTime();

  let query = supabase
    .from("opportunities")
    .select(`
      id,
      title,
      deadline,
      status,
      workspace_id,
      reminder_7d_sent_at,
      reminder_3d_sent_at,
      reminder_24h_sent_at
    `)
    .in("status", ["pursuing", "preparing"])
    .not("deadline", "is", null);

  if (targetWorkspaceId) {
    query = query.eq("workspace_id", targetWorkspaceId);
  }

  const { data: opps, error } = await query;
  if (error) {
    console.error("[Reminders] Error querying opportunities:", error.message);
    summary.errors.push(error.message);
    return summary;
  }

  if (!opps || opps.length === 0) {
    return summary;
  }

  summary.checkedOpportunities = opps.length;

  for (const opp of opps) {
    if (!opp.deadline) continue;
    const deadlineDate = new Date(opp.deadline);
    const deadlineMs = deadlineDate.getTime();
    const diffMs = deadlineMs - nowMs;

    // Skip if already passed
    if (diffMs <= 0) continue;

    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.max(1, Math.ceil(diffHours / 24));

    let reminderType: "24h" | "3d" | "7d" | null = null;

    if (diffHours <= 24 && !opp.reminder_24h_sent_at) {
      reminderType = "24h";
    } else if (diffDays <= 3 && !opp.reminder_3d_sent_at && !opp.reminder_24h_sent_at) {
      reminderType = "3d";
    } else if (diffDays <= 7 && !opp.reminder_7d_sent_at && !opp.reminder_3d_sent_at && !opp.reminder_24h_sent_at) {
      reminderType = "7d";
    }

    if (!reminderType) continue;

    // Find workspace members to notify
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id, profiles(email, full_name)")
      .eq("workspace_id", opp.workspace_id);

    const recipientEmails = new Set<string>();
    if (members) {
      for (const m of members) {
        const prof = m.profiles as { email?: string | null } | null;
        if (prof?.email) {
          recipientEmails.add(prof.email);
        }
      }
    }

    const siteUrl = process.env["APP_URL"] || "https://getbidradar.com";
    const workspaceUrl = `${siteUrl}/tenders/${opp.id}/workspace`;
    const formattedDeadline = deadlineDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const notifTitle = `Deadline Alert: ${opp.title}`;
    const notifBody =
      reminderType === "24h"
        ? `Less than 24 hours remaining until submission deadline (${formattedDeadline}).`
        : `${diffDays} days remaining until submission deadline (${formattedDeadline}).`;

    // Create in-app notification
    await supabase.from("notifications").insert({
      workspace_id: opp.workspace_id,
      kind: "deadline_reminder",
      title: notifTitle,
      body: notifBody,
      link: `/tenders/${opp.id}/workspace`,
    });

    // Dispatch email notifications
    for (const email of recipientEmails) {
      try {
        await sendDeadlineReminderEmail({
          to: email,
          tenderTitle: opp.title,
          daysRemaining: diffDays,
          deadline: formattedDeadline,
          url: workspaceUrl,
        });
        summary.remindersSent++;
      } catch (sendErr) {
        console.error(`[Reminders] Failed sending reminder to ${email}:`, sendErr);
        summary.errors.push(String(sendErr));
      }
    }

    // Mark reminder column idempotently
    const updatePayload: Partial<Database["public"]["Tables"]["opportunities"]["Update"]> = {};
    if (reminderType === "24h") updatePayload.reminder_24h_sent_at = now.toISOString();
    if (reminderType === "3d") updatePayload.reminder_3d_sent_at = now.toISOString();
    if (reminderType === "7d") updatePayload.reminder_7d_sent_at = now.toISOString();

    await supabase
      .from("opportunities")
      .update(updatePayload)
      .eq("id", opp.id);
  }

  return summary;
}
