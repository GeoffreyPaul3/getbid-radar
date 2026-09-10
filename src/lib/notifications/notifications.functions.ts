import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  type NotificationRecord,
} from "./notifications.server";

export const getUnreadNotificationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<NotificationRecord[]> => {
    return getUnreadNotifications(context.supabase, data.workspaceId, context.userId);
  });

export const getUnreadCountFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const count = await getUnreadCount(context.supabase, data.workspaceId, context.userId);
    return { count };
  });

export const markNotificationReadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ workspaceId: z.string().uuid(), notificationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await markNotificationRead(context.supabase, data.workspaceId, data.notificationId);
    return { success: true };
  });

export const markAllReadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await markAllNotificationsRead(context.supabase, data.workspaceId, context.userId);
    return { success: true };
  });
