import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface PlatformAdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
  is_platform_admin: boolean;
}

/**
 * Server-side security guard that ensures the given user is a platform administrator.
 * Throws an error if the user is not found or is_platform_admin is false.
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
