import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { InvitationDetails, AppRole } from "./members.types";

/**
 * Public lookup for invitation token.
 * Validates token existence and expiry without requiring session authentication.
 */
export const lookupInvitationByTokenFn = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string().min(1),
      })
      .parse(data)
  )
  .handler(async ({ data }): Promise<InvitationDetails> => {
    const { data: rows, error } = await supabaseAdmin.rpc("lookup_invitation_by_token", {
      _token: data.token,
    });

    if (error) {
      console.error("[Invitation] Token lookup error:", error);
      throw new Error("Unable to verify invitation link. Please try again.");
    }

    const row = rows?.[0];
    if (!row) {
      throw new Error("Invalid or expired invitation link.");
    }

    const isExpired = new Date(row.expires_at).getTime() < Date.now();
    const isAccepted = row.status === "accepted";

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      email: row.email,
      fullName: row.full_name || "",
      role: row.role as AppRole,
      status: row.status,
      expiresAt: row.expires_at,
      invitedByName: row.invited_by_name || "A workspace administrator",
      isExpired,
      isAccepted,
    };
  });

/**
 * Protected invitation acceptance.
 * Atomically marks invitation accepted, links user to workspace, and consumes token.
 */
export const acceptInvitationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        token: z.string().min(1),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await supabaseAdmin.rpc("accept_invitation_by_token", {
      _token: data.token,
      _user_id: context.userId,
    });

    if (error) {
      console.error("[Invitation] Accept RPC error:", error);
      throw new Error(error.message || "Failed to accept workspace invitation.");
    }

    const res = result as {
      success?: boolean;
      error?: string;
      message?: string;
      workspace_id?: string;
      workspace_name?: string;
      role?: string;
    };

    if (!res || res.success === false) {
      throw new Error(res?.message || "Failed to accept workspace invitation.");
    }

    return {
      success: true,
      workspaceId: res.workspace_id,
      workspaceName: res.workspace_name,
      role: res.role,
    };
  });

/**
 * Dismiss the first-login temporary password change prompt.
 */
export const dismissPasswordChangePromptFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({}).optional().parse(data))
  .handler(async ({ context }) => {
    // Clear flag in profiles table
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq("id", context.userId);

    // Clear flag in Supabase auth user metadata
    try {
      const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      if (userRecord?.user) {
        await supabaseAdmin.auth.admin.updateUserById(context.userId, {
          user_metadata: {
            ...userRecord.user.user_metadata,
            must_change_password: false,
          },
        });
      }
    } catch (err) {
      console.warn("[Auth] Failed to clear must_change_password metadata:", err);
    }

    return { success: true };
  });
