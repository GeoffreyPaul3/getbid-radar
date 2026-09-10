import React, { useState, useEffect } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  BarChart3,
  ArrowLeft,
  Loader2,
  Lock,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import logo from "@/assets/bidradar.png";
import { checkPlatformAdminStatusFn } from "@/lib/admin/admin.functions";

interface AdminShellProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AdminShell({ children, title, description }: AdminShellProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setIsAdmin(false);
      setChecking(false);
      navigate({
        to: "/login",
        search: { redirect: currentPath },
      });
      return;
    }

    let isMounted = true;
    checkPlatformAdminStatusFn({ data: { userId: user.id } })
      .then((res) => {
        if (isMounted) {
          setIsAdmin(res.isPlatformAdmin);
          setChecking(false);
        }
      })
      .catch((err) => {
        console.error("[AdminShell] Admin verification error:", err);
        if (isMounted) {
          setIsAdmin(false);
          setChecking(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id, authLoading]);

  // 1. Loading State
  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-xs text-muted-foreground font-mono">
          Verifying operator credentials...
        </p>
      </div>
    );
  }

  // 2. Access Denied State (Clean, production-grade restricted screen)
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border/80 bg-surface p-8 shadow-panel text-center space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display font-bold text-2xl text-foreground">
              Access Restricted
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              This administrative area is reserved for GetBidRadar platform operators. If you believe you should have access, please contact your system administrator.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="outline" className="text-xs">
              <Link to="/dashboard">Return to Workspace</Link>
            </Button>
            <Button
              className="text-xs font-semibold"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Admin Dashboard Layout
  const navItems = [
    {
      label: "Platform Overview",
      href: "/admin",
      icon: LayoutDashboard,
      active: currentPath === "/admin",
    },
    {
      label: "Companies & Workspaces",
      href: "/admin/companies",
      icon: Building2,
      active: currentPath === "/admin/companies",
    },
    {
      label: "Users & Operators",
      href: "/admin/users",
      icon: Users,
      active: currentPath === "/admin/users",
    },
    {
      label: "Revenue & Transactions",
      href: "/admin/revenue",
      icon: CreditCard,
      active: currentPath === "/admin/revenue",
    },
    {
      label: "Platform Analytics",
      href: "/admin/analytics",
      icon: BarChart3,
      active: currentPath === "/admin/analytics",
    },
  ];

  return (
    <div className="min-h-screen bg-canvas flex flex-col lg:flex-row font-sans text-foreground">
      {/* Admin Sidebar */}
      <aside className="w-full lg:w-64 border-r border-border bg-surface flex flex-col shrink-0">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2.5">
            <img src={logo} width={120} height={120} alt="BidRadar" />
          </Link>
          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary font-mono font-bold">
            ADMIN
          </Badge>
        </div>

        <div className="px-3 py-4 flex-1 space-y-1">
          <p className="px-3 pb-2 text-[10px] font-semibold text-muted-foreground font-mono uppercase tracking-wider">
            Operator Console
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  item.active
                    ? "bg-primary-soft text-primary font-semibold"
                    : "text-text-secondary hover:text-foreground hover:bg-surface-muted"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-border bg-surface-muted/30 space-y-3">
          <div className="text-[11px] text-muted-foreground truncate">
            Logged in as <span className="font-semibold text-foreground">{user.email}</span>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full text-xs justify-between">
            <Link to="/dashboard">
              <span className="flex items-center gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to App
              </span>
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            </Link>
          </Button>
        </div>
      </aside>

      {/* Main Admin Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-surface/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-foreground">{title}</h1>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-bid/25 bg-bid-soft text-bid text-[11px] font-mono font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Operator Session Active</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
