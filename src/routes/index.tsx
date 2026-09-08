import React, { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexRouter,
});

function IndexRouter() {
  const { user, isLoading: authLoading } = useAuth();
  const { workspace, isOnboarded, isLoading: wsLoading } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || wsLoading) return;

    if (!user) {
      navigate({ to: "/login" });
    } else if (!isOnboarded) {
      navigate({ to: "/onboarding" });
    } else {
      navigate({ to: "/dashboard" });
    }
  }, [user, authLoading, wsLoading, isOnboarded, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-mono font-bold text-sm shadow-sm">
          <span>BR</span>
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
          </span>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <p className="text-xs text-muted-foreground font-mono">Initializing GetBidRadar...</p>
      </div>
    </div>
  );
}
