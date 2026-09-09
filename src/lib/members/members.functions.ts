/**
 * Server functions (RPC) for workspace member management.
 * Protected by requireSupabaseAuth middleware.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  listWorkspaceMembers,
  inviteWorkspaceMember,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  type AppRole,
} from "./members.server";

const roleSchema = z.enum(["owner", "admin", "member", "viewer"]);

export const getWorkspaceMembersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return listWorkspaceMembers(context.supabase, data.workspaceId, context.userId);
  });

export const inviteWorkspaceMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        email: z.string().email(),
        fullName: z.string().min(1).max(100),
        role: roleSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return inviteWorkspaceMember(context.supabase, {
      workspaceId: data.workspaceId,
      callerUserId: context.userId,
      email: data.email,
      fullName: data.fullName,
      role: data.role as AppRole,
    });
  });

export const updateMemberRoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        targetMemberId: z.string().uuid(),
        newRole: roleSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return updateWorkspaceMemberRole(context.supabase, {
      workspaceId: data.workspaceId,
      callerUserId: context.userId,
      targetMemberId: data.targetMemberId,
      newRole: data.newRole as AppRole,
    });
  });

export const removeMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        targetMemberId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return removeWorkspaceMember(context.supabase, {
      workspaceId: data.workspaceId,
      callerUserId: context.userId,
      targetMemberId: data.targetMemberId,
    });
  });

export const revokeInvitationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        invitationId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return revokeWorkspaceInvitation(context.supabase, {
      workspaceId: data.workspaceId,
      callerUserId: context.userId,
      invitationId: data.invitationId,
    });
  });
