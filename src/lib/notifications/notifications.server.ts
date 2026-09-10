/**
 * Notifications Server — In-app notification helpers.
 * Schema: notifications(id, workspace_id, user_id, kind, title, body, link, read_at, created_at)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Client = SupabaseClient<Database>;

export type NotificationType =
  | "analysis_complete"
  | "analysis_failed"
  | "compliance_complete"
  | "compliance_critical"
  | "submission_recorded"
  | "task_overdue"
  | "task_assigned";

interface EmitNotificationInput {
  workspaceId: string;
  userId: string;
  kind: NotificationType;
  title: string;
  body: string;
  link?: string;
}

export async function emitNotification(
  supabase: Client,
  input: EmitNotificationInput,
): Promise<void> {
  try {
    await supabase.from("notifications").insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      link: input.link || null,
    });
  } catch (err) {
    console.warn("[Notifications] Failed to emit notification:", err);
  }
}

export type NotificationRecord = Database["public"]["Tables"]["notifications"]["Row"];

export async function getUnreadNotifications(
  supabase: Client,
  workspaceId: string,
  userId: string,
  limit = 20,
): Promise<NotificationRecord[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getAllNotifications(
  supabase: Client,
  workspaceId: string,
  userId: string,
  limit = 30,
): Promise<NotificationRecord[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function markNotificationRead(
  supabase: Client,
  workspaceId: string,
  notificationId: string,
): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("workspace_id", workspaceId);
}

export async function markAllNotificationsRead(
  supabase: Client,
  workspaceId: string,
  userId: string,
): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .is("read_at", null);
}

export async function getUnreadCount(
  supabase: Client,
  workspaceId: string,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}
