import React, { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  BookOpen,
  Settings,
  LogOut,
  Building2,
  ShieldCheck,
  ChevronDown,
  Menu,
  X,
  Radar,
  Sparkles,
  FileSearch,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/bidradar.png"

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, signOut } = useAuth();
  const { workspace, allWorkspaces, role, companyProfile, completenessScore, switchWorkspace } =
    useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const intelligenceNav = [
    {
      label: "Overview",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: currentPath === "/dashboard",
    },
    {
      label: "Tenders",
      href: "/tenders",
      icon: FileText,
      active: currentPath.startsWith("/tenders") && currentPath !== "/tenders/new",
    },
    {
      label: "Company Evidence",
      href: "/knowledge",
      icon: BookOpen,
      active: currentPath.startsWith("/knowledge"),
    },
  ];

  const organizationNav = [
    {
      label: "Profile & Settings",
      href: "/settings",
      icon: Settings,
      active: currentPath.startsWith("/settings"),
    },
  ];

  return (
    <div className="flex min-h-screen bg-canvas text-foreground font-sans antialiased selection:bg-primary-soft selection:text-primary">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-surface shrink-0 z-20">
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-border/70">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
             <img src={logo} width={160} height={140} alt="BidRadar" />
          </Link>
        </div>

        {/* Workspace Identity Module */}
        <div className="p-3.5 border-b border-border/60">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-surface-muted/50 hover:bg-surface-muted transition-colors text-left group">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft text-primary shrink-0">
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate text-foreground leading-tight">
                      {companyProfile?.company_name || workspace?.name || "Workspace"}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                      {role || "Member"}
                    </p>
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-mono uppercase">
                Workspaces
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allWorkspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => switchWorkspace(ws.id)}
                  className={`text-xs cursor-pointer flex items-center justify-between ${
                    ws.id === workspace?.id ? "font-semibold bg-primary-soft text-primary" : ""
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === workspace?.id && (
                    <Badge
                      variant="outline"
                      className="text-[9px] py-0 px-1 border-primary/40 text-primary"
                    >
                      Active
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile Completeness Gauge */}
          <div className="mt-2.5 px-1">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                <FileSearch className="h-3 w-3 text-primary" />
                Evidence Calibration
              </span>
              <span className="font-mono font-bold text-foreground">{completenessScore}%</span>
            </div>
            <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden border border-border/50">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${completenessScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action CTA */}
        <div className="px-3.5 pt-3 pb-1">
          <Link
            to="/tenders/new"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-bright shadow-subtle transition-all duration-150 active:scale-[0.98]"
          >
            <PlusCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Analyze a Tender</span>
          </Link>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {/* Intelligence Section */}
          <div>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold text-muted-foreground font-mono uppercase tracking-wider">
              Intelligence
            </p>
            <div className="space-y-0.5">
              {intelligenceNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      item.active
                        ? "bg-primary-soft text-primary font-semibold"
                        : "text-text-secondary hover:text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${item.active ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Organization Section */}
          <div>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold text-muted-foreground font-mono uppercase tracking-wider">
              Organization
            </p>
            <div className="space-y-0.5">
              {organizationNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      item.active
                        ? "bg-primary-soft text-primary font-semibold"
                        : "text-text-secondary hover:text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${item.active ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User Footer */}
        <div className="p-3.5 border-t border-border/70 bg-surface">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 rounded-full bg-primary-soft text-primary items-center justify-center font-mono text-xs font-bold shrink-0">
                {user?.email?.slice(0, 2).toUpperCase() || "GB"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate text-foreground">{user?.email}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="h-3 w-3 text-bid" />
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">
                    {role || "Active"}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-nobid-soft"
              onClick={signOut}
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden">
        {/* Mobile Header */}
        <header className="flex md:hidden h-14 items-center justify-between px-4 border-b border-border bg-surface sticky top-0 z-30">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
              <Radar className="h-3.5 w-3.5" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight text-foreground">
              GetBid<span className="text-primary">Radar</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/tenders/new"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary text-white"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Ingest</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-8 w-8"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border bg-surface px-4 py-3 space-y-3 shadow-panel">
            <div className="space-y-1">
              {[...intelligenceNav, ...organizationNav].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                      item.active
                        ? "bg-primary-soft text-primary font-semibold"
                        : "text-text-secondary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-xs text-destructive"
              >
                <LogOut className="h-3.5 w-3.5 mr-1" /> Sign Out
              </Button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
