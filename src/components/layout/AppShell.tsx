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
  Sparkles,
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

  const navItems = [
    {
      label: "Dashboard",
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
      label: "Ingest Tender",
      href: "/tenders/new",
      icon: PlusCircle,
      active: currentPath === "/tenders/new",
      highlight: true,
    },
    {
      label: "Evidence Base",
      href: "/knowledge",
      icon: BookOpen,
      active: currentPath.startsWith("/knowledge"),
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      active: currentPath.startsWith("/settings"),
    },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans antialiased">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar shrink-0">
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-border/60">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-mono font-bold text-sm shadow-sm transition-transform group-hover:scale-105">
              <span>BR</span>
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold tracking-tight text-base text-foreground leading-none">
                GetBid<span className="text-accent">Radar</span>
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono mt-0.5">
                AI Intelligence
              </span>
            </div>
          </Link>
        </div>

        {/* Workspace Switcher */}
        <div className="p-4 border-b border-border/40">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/60 bg-surface/50 hover:bg-surface transition-colors text-left">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary text-secondary-foreground shrink-0">
                    <Building2 className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate text-foreground">
                      {companyProfile?.company_name || workspace?.name || "Workspace"}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                      {role || "member"}
                    </p>
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Workspaces
              </DropdownMenuLabel>
              {allWorkspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => switchWorkspace(ws.id)}
                  className={`text-xs cursor-pointer flex items-center justify-between ${
                    ws.id === workspace?.id ? "font-semibold bg-accent/10" : ""
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === workspace?.id && (
                    <Badge variant="outline" className="text-[9px] py-0 px-1">
                      Active
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile Completeness Pill */}
          <div className="mt-3 px-1">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-muted-foreground flex items-center gap-1 font-mono">
                <Sparkles className="h-3 w-3 text-accent" /> Readiness
              </span>
              <span className="font-mono font-bold text-foreground">{completenessScore}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-accent h-full rounded-full transition-all duration-500"
                style={{ width: `${completenessScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.highlight) {
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all my-2 shadow-sm ${
                    item.active
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            }
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/80"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-border/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 rounded-full bg-secondary text-secondary-foreground items-center justify-center font-mono text-xs font-bold shrink-0">
                {user?.email?.slice(0, 2).toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate text-foreground">{user?.email}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="h-3 w-3 text-accent" />
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">
                    {role || "User"}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={signOut}
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden">
        {/* Mobile Header */}
        <header className="flex md:hidden h-14 items-center justify-between px-4 border-b border-border bg-card">
          <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground font-mono text-xs font-bold">
              BR
            </div>
            <span className="text-sm tracking-tight">
              GetBid<span className="text-accent">Radar</span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="h-9 w-9"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border bg-card px-4 py-3 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                    item.active
                      ? "bg-secondary text-foreground font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut}>
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
