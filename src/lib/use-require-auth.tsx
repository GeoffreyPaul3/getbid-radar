import React, { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "./auth-context";
import { useWorkspace } from "./workspace-context";
import { getSafeRedirect } from "./auth-redirect";
import { Loader2 } from "lucide-react";

interface RequireAuthOptions {
  requireWorkspace?: boolean;
}

export function useRequireAuth(options: RequireAuthOptions = { requireWorkspace: true }) {
  const { user, isLoading: authLoading } = useAuth();
  const { workspace, isLoading: wsLoading, member, companyProfile, isOnboarded } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  const requireWorkspace = options.requireWorkspace ?? true;
  // location.search is a parsed object in TanStack Router — use location.href for the
  // full serialized path (pathname + "?" + searchStr + hash) safe for redirect params.
  const currentPath = location.href;

  useEffect(() => {
    // 1. Wait for auth initialization to complete
    if (authLoading) return;

    // 2. Anonymous user: redirect to /login with target destination
    if (!user) {
      const safeRedirect = getSafeRedirect(currentPath);
      navigate({
        to: "/login",
        search: safeRedirect ? { redirect: safeRedirect } : {},
      });
      return;
    }

    // 3. User authenticated, check workspace requirement once workspace loading finishes
    if (requireWorkspace && !wsLoading) {
      if (!workspace) {
        const safeRedirect = getSafeRedirect(currentPath);
        navigate({
          to: "/onboarding",
          search: safeRedirect ? { redirect: safeRedirect } : {},
        });
      }
    }
  }, [authLoading, user, wsLoading, workspace, requireWorkspace, currentPath, navigate]);

  const isReady =
    !authLoading &&
    Boolean(user) &&
    (!requireWorkspace || (!wsLoading && Boolean(workspace)));

  const AuthLoadingFallback = (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center justify-center space-y-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-mono">
          Verifying session credentials...
        </p>
      </div>
    </div>
  );

  return {
    isReady,
    user,
    workspace,
    member,
    companyProfile,
    isOnboarded,
    AuthLoadingFallback,
  };
}
