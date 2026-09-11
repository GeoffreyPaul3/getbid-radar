import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface PlatformAdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
  is_platform_admin: boolean;
}

/**
 * TanStack Start middleware for platform operator endpoints.
 * First validates the caller's cryptographic JWT session via requireSupabaseAuth,
 * then checks profiles.is_platform_admin for context.userId.
 *
 * Prevents unauthorized access and IDOR (never relies on client-supplied user IDs).
 */
export const requirePlatformAdminMiddleware = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const userId = context.userId;
    if (!userId) {
      throw new Error("UNAUTHORIZED_PLATFORM_ADMIN: No authenticated session found.");
    }

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, is_platform_admin")
      .eq("id", userId)
      .maybeSingle();

    if (error || !profile) {
      console.error("[AdminGuard] Profile lookup failed:", error?.message);
      throw new Error("UNAUTHORIZED_PLATFORM_ADMIN: Profile not found.");
    }

    if (!profile.is_platform_admin) {
      console.warn(`[AdminGuard] Access denied for non-platform-admin user: ${userId}`);
      throw new Error(
        "UNAUTHORIZED_PLATFORM_ADMIN: Platform operator privileges required."
      );
    }

    return next({
      context: {
        ...context,
        adminUser: profile as PlatformAdminUser,
      },
    });
  });

/**
 * Server-side security helper for functions that receive a verified userId.
 */
export async function requirePlatformAdmin(userId: string): Promise<PlatformAdminUser> {
  if (!userId) {
    throw new Error("UNAUTHORIZED_PLATFORM_ADMIN: No user ID provided.");
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, is_platform_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    console.error("[AdminGuard] Profile lookup failed:", error?.message);
    throw new Error("UNAUTHORIZED_PLATFORM_ADMIN: Profile not found.");
  }

  if (!profile.is_platform_admin) {
    console.warn(`[AdminGuard] Access denied for non-platform-admin user: ${userId}`);
    throw new Error(
      "UNAUTHORIZED_PLATFORM_ADMIN: Platform operator privileges required."
    );
  }

  return profile as PlatformAdminUser;
}
