/**
 * Authentication and routing redirect security utilities.
 * Ensures open-redirect immunity and reliable destination resolution.
 */

/**
 * Validates and sanitizes internal redirect URLs.
 * Rejects external URLs, protocol-relative attacks (//), control characters,
 * and circular redirects back to /login.
 */
export function getSafeRedirect(rawRedirect?: string | null | undefined): string | null {
  if (!rawRedirect || typeof rawRedirect !== "string") return null;

  const trimmed = rawRedirect.trim();
  if (!trimmed) return null;

  // Must begin with a single slash, not protocol-relative (//)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  // Prevent redirect loops to login
  if (trimmed === "/login" || trimmed.startsWith("/login?") || trimmed.startsWith("/login/")) {
    return null;
  }

  try {
    const dummyOrigin = "https://getbidradar.internal";
    const parsed = new URL(trimmed, dummyOrigin);
    if (parsed.origin !== dummyOrigin) return null;

    // Return the safe relative path + search + hash
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return null;
  }
}

/**
 * Resolves the destination for an authenticated user based on their workspace onboarding state.
 */
export function resolveAuthDestination(options: {
  hasWorkspace: boolean;
  isOnboarded: boolean;
  rawRedirect?: string | null | undefined;
}): string {
  const safeRedirect = getSafeRedirect(options.rawRedirect);

  // If user has no workspace or hasn't finished onboarding, route to onboarding
  if (!options.hasWorkspace || !options.isOnboarded) {
    return safeRedirect
      ? `/onboarding?redirect=${encodeURIComponent(safeRedirect)}`
      : "/onboarding";
  }

  // Established user: return requested destination or default to executive dashboard
  return safeRedirect || "/dashboard";
}
