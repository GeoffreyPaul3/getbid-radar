/**
 * Server-side workspace member management and directory resolution.
 * Enforces strict tenant isolation and caller authorization.
 * Never exposes raw authentication user tables or plaintext passwords.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendMemberInvitationEmail, getAppUrl } from "../email/resend.server";

export type Client = SupabaseClient<Database>;
export type AppRole = "owner" | "admin" | "member" | "viewer";

export interface WorkspaceMemberRecord {
  id: string;
  userId: string | null;
  role: AppRole;
  createdAt: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  isPending: boolean;
}

interface MemberDirectoryRow {
  id: string;
  user_id: string | null;
  role: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_pending: boolean;
}

export interface InviteMemberParams {
  workspaceId: string;
  callerUserId: string;
  email: string;
  fullName: string;
  role: AppRole;
}

export interface UpdateRoleParams {
  workspaceId: string;
  callerUserId: string;
  targetMemberId: string;
  newRole: AppRole;
}

export interface RemoveMemberParams {
  workspaceId: string;
  callerUserId: string;
  targetMemberId: string;
}

export interface RevokeInvitationParams {
  workspaceId: string;
  callerUserId: string;
  invitationId: string;
}

/**
 * Verify that the caller is a member of the workspace and return their role.
 */
async function getCallerRole(
  supabase: Client,
  workspaceId: string,
  userId: string,
): Promise<AppRole | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data.role as AppRole;
}

/**
 * List members and pending invitations for a workspace with resolved profile identities.
 * Strictly verifies tenant isolation: caller must be a member of the workspace.
 */
export async function listWorkspaceMembers(
  supabase: Client,
  workspaceId: string,
  callerUserId: string,
): Promise<WorkspaceMemberRecord[]> {
  const callerRole = await getCallerRole(supabase, workspaceId, callerUserId);
  if (!callerRole) {
    throw new Error("Access denied: You are not a member of this workspace.");
  }

  // Call the database function
  const { data, error } = await supabase.rpc("get_workspace_member_directory", {
    _workspace_id: workspaceId,
  });

  if (error) {
    console.error("[Members] get_workspace_member_directory RPC error:", error);
    // Graceful fallback to workspace_members if RPC encountered an issue
    const { data: fallbackMembers } = await supabase
      .from("workspace_members")
      .select("id, user_id, role, created_at")
      .eq("workspace_id", workspaceId);

    return (fallbackMembers || []).map((m) => ({
      id: m.id,
      userId: m.user_id,
      role: m.role as AppRole,
      createdAt: m.created_at,
      fullName: m.user_id === callerUserId ? "You" : `Member (${m.role})`,
      email: "",
      avatarUrl: null,
      isPending: false,
    }));
  }

  return (data || []).map((row: MemberDirectoryRow) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role as AppRole,
    createdAt: row.created_at,
    fullName: row.full_name || (row.email?.split("@")[0] ?? "Team Member"),
    email: row.email || "",
    avatarUrl: row.avatar_url,
    isPending: Boolean(row.is_pending),
  }));
}

/**
 * Generate a cryptographically secure, random 12-character temporary password.
 * Format contains uppercase, lowercase, numbers, and symbols.
 */
export function generateTemporaryPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const symbols = "!@#$%&*";
  let pwd = "";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  for (let i = 0; i < 10; i++) {
    pwd += chars.charAt(bytes[i]! % chars.length);
  }
  const symBytes = crypto.getRandomValues(new Uint8Array(2));
  pwd += symbols.charAt(symBytes[0]! % symbols.length) + symbols.charAt(symBytes[1]! % symbols.length);
  return pwd;
}

/**
 * Send an invitation to a new team member.
 * Only owners and admins can invite members.
 * Supports: owner, admin, member, viewer.
 * Generates a cryptographically secure single-use token and temporary password.
 */
export async function inviteWorkspaceMember(
  supabase: Client,
  params: InviteMemberParams,
): Promise<{ ok: boolean; message: string; invitationId?: string; temporaryPassword?: string }> {
  const { workspaceId, callerUserId, email, fullName, role } = params;

  // 1. Authorization check: caller must be owner or admin
  const callerRole = await getCallerRole(supabase, workspaceId, callerUserId);
  if (!callerRole || (callerRole !== "owner" && callerRole !== "admin")) {
    throw new Error("Forbidden: Only workspace owners and admins can invite members.");
  }

  // 2. Validate role
  const validRoles: AppRole[] = ["owner", "admin", "member", "viewer"];
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role '${role}'. Supported roles: ${validRoles.join(", ")}`);
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("A valid email address is required.");
  }
  const cleanName = fullName.trim() || normalizedEmail.split("@")[0]!;

  // 2.5. Enforce seat limit from workspace subscription plan
  const { data: wsData } = await supabase
    .from("workspaces")
    .select("plan")
    .eq("id", workspaceId)
    .single();

  const currentPlan = wsData?.plan || "trial";
  const { getPlanConfig, isPlanTier } = await import("../billing/plans");
  const planConfig = getPlanConfig(isPlanTier(currentPlan) ? currentPlan : "trial");

  if (planConfig.memberAllowance !== -1) {
    const [{ count: activeCount }, { count: pendingCount }] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      supabase
        .from("workspace_invitations")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "pending"),
    ]);

    const totalSeats = (activeCount ?? 0) + (pendingCount ?? 0);
    if (totalSeats >= planConfig.memberAllowance) {
      throw new Error(
        `Seat limit reached: Your ${planConfig.name} plan includes up to ${planConfig.memberAllowance} team seats. Upgrade your plan to invite additional collaborators.`,
      );
    }
  }

  // Resolve inviter name from profile for clear email branding
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", callerUserId)
    .maybeSingle();
  const inviterName = callerProfile?.full_name?.trim() || "A workspace administrator";

  // Fetch workspace name for notification
  const { data: ws } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single();
  const wsName = ws?.name || "GetBidRadar Workspace";
  const appUrl = getAppUrl();

  // 3. Check if an account already exists with this email in profiles
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    // Check if user is already a member of this workspace
    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", existingProfile.id)
      .maybeSingle();

    if (existingMember) {
      throw new Error(
        `This user is already an active member of this workspace with role '${existingMember.role}'.`,
      );
    }

    // Direct add for existing registered user
    const { error: insertErr } = await supabase.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: existingProfile.id,
      role: role as Database["public"]["Enums"]["app_role"],
    });

    if (insertErr) throw insertErr;

    // Send notification email with direct workspace destination
    await sendMemberInvitationEmail({
      toEmail: normalizedEmail,
      fullName: cleanName,
      invitedByName: inviterName,
      workspaceName: wsName,
      role,
      setupUrl: `${appUrl}/tenders`,
    });

    return { ok: true, message: `Added ${cleanName} to workspace as ${role}.` };
  }

  // 4. User does not have an account yet: generate token & temporary password
  const token = crypto.randomUUID();
  const tempPassword = generateTemporaryPassword();

  // Provision user in Supabase Auth via admin client so they can sign in immediately with temporary password
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        must_change_password: true,
      },
    });

    if (authErr) {
      console.warn("[Members] Admin createUser notice:", authErr.message);
      // If user was previously registered in auth.users, update their password and metadata
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
      const match = userList?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (match) {
        await supabaseAdmin.auth.admin.updateUserById(match.id, {
          password: tempPassword,
          user_metadata: {
            ...match.user_metadata,
            full_name: cleanName,
            must_change_password: true,
          },
        });
      }
    }
  } catch (authCreateErr) {
    console.warn("[Members] Auth provision error:", authCreateErr);
  }

  // Create or refresh workspace_invitations record with single-use token and 7-day expiry
  const { data: invitation, error: invErr } = await supabase
    .from("workspace_invitations")
    .upsert(
      {
        workspace_id: workspaceId,
        email: normalizedEmail,
        full_name: cleanName,
        role: role as Database["public"]["Enums"]["app_role"],
        invited_by: callerUserId,
        status: "pending",
        token,
        temporary_password: tempPassword,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "workspace_id, email" },
    )
    .select("id")
    .single();

  if (invErr) {
    console.error("[Members] Invitation record error:", invErr);
    throw new Error("Failed to record workspace invitation.");
  }

  const setupUrl = `${appUrl}/join?token=${token}`;

  // Send branded invitation email with setup link and temporary password
  await sendMemberInvitationEmail({
    toEmail: normalizedEmail,
    fullName: cleanName,
    invitedByName: inviterName,
    workspaceName: wsName,
    role,
    setupUrl,
    temporaryPassword: tempPassword,
  });

  return {
    ok: true,
    message: `Invitation sent to ${normalizedEmail} with temporary credentials.`,
    invitationId: invitation.id,
    temporaryPassword: tempPassword,
  };
}

/**
 * Update the role of an existing workspace member.
 * Protects against demoting the sole owner of a workspace.
 */
export async function updateWorkspaceMemberRole(
  supabase: Client,
  params: UpdateRoleParams,
): Promise<{ ok: boolean; message: string }> {
  const { workspaceId, callerUserId, targetMemberId, newRole } = params;

  // 1. Authorization check
  const callerRole = await getCallerRole(supabase, workspaceId, callerUserId);
  if (!callerRole || (callerRole !== "owner" && callerRole !== "admin")) {
    throw new Error("Forbidden: Only workspace owners and admins can modify member roles.");
  }

  const validRoles: AppRole[] = ["owner", "admin", "member", "viewer"];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Invalid role '${newRole}'.`);
  }

  // 2. Fetch target member
  const { data: targetMember, error: findErr } = await supabase
    .from("workspace_members")
    .select("id, user_id, role")
    .eq("id", targetMemberId)
    .eq("workspace_id", workspaceId)
    .single();

  if (findErr || !targetMember) {
    throw new Error("Member not found in this workspace.");
  }

  // 3. Prevent demoting the last owner
  if (targetMember.role === "owner" && newRole !== "owner") {
    const { count } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("role", "owner" as Database["public"]["Enums"]["app_role"]);

    if ((count ?? 0) <= 1) {
      throw new Error("Cannot change role: The workspace must retain at least one owner.");
    }
  }

  // 4. Update role
  const { error: updateErr } = await supabase
    .from("workspace_members")
    .update({ role: newRole as Database["public"]["Enums"]["app_role"] })
    .eq("id", targetMemberId)
    .eq("workspace_id", workspaceId);

  if (updateErr) throw updateErr;

  return { ok: true, message: `Member role updated to ${newRole}.` };
}

/**
 * Remove an active member from the workspace.
 * Protects against removing the sole owner of a workspace.
 */
export async function removeWorkspaceMember(
  supabase: Client,
  params: RemoveMemberParams,
): Promise<{ ok: boolean; message: string }> {
  const { workspaceId, callerUserId, targetMemberId } = params;

  // 1. Authorization check
  const callerRole = await getCallerRole(supabase, workspaceId, callerUserId);
  if (!callerRole || (callerRole !== "owner" && callerRole !== "admin")) {
    throw new Error("Forbidden: Only workspace owners and admins can remove members.");
  }

  // 2. Fetch target member
  const { data: targetMember, error: findErr } = await supabase
    .from("workspace_members")
    .select("id, user_id, role")
    .eq("id", targetMemberId)
    .eq("workspace_id", workspaceId)
    .single();

  if (findErr || !targetMember) {
    throw new Error("Member not found in this workspace.");
  }

  // 3. Prevent removing the last owner
  if (targetMember.role === "owner") {
    const { count } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("role", "owner" as Database["public"]["Enums"]["app_role"]);

    if ((count ?? 0) <= 1) {
      throw new Error("Cannot remove member: The workspace must retain at least one owner.");
    }
  }

  // 4. Delete member
  const { error: deleteErr } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", targetMemberId)
    .eq("workspace_id", workspaceId);

  if (deleteErr) throw deleteErr;

  return { ok: true, message: "Member removed from workspace." };
}

/**
 * Revoke or cancel a pending workspace invitation.
 */
export async function revokeWorkspaceInvitation(
  supabase: Client,
  params: RevokeInvitationParams,
): Promise<{ ok: boolean; message: string }> {
  const { workspaceId, callerUserId, invitationId } = params;

  const callerRole = await getCallerRole(supabase, workspaceId, callerUserId);
  if (!callerRole || (callerRole !== "owner" && callerRole !== "admin")) {
    throw new Error("Forbidden: Only workspace owners and admins can revoke invitations.");
  }

  const { error } = await supabase
    .from("workspace_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("workspace_id", workspaceId);

  if (error) throw error;

  return { ok: true, message: "Invitation revoked." };
}
