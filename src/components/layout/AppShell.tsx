import React, { useState, useEffect } from "react";
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
  PanelLeftClose,
  PanelLeft,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import logo from "@/assets/bidradar.png";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, signOut } = useAuth();
  const { workspace, allWorkspaces, role, companyProfile, completenessScore, switchWorkspace } =
    useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("getbid_sidebar_collapsed");
      if (saved === "true") setIsCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("getbid_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

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
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen bg-canvas text-foreground font-sans antialiased selection:bg-primary-soft selection:text-primary">
        {/* Desktop Sidebar — sticky to remain in view as you scroll down pages */}
        <aside
          className={cn(
            "hidden md:flex sticky top-0 h-screen flex-col border-r border-border bg-surface shrink-0 z-20 transition-[width] duration-200 ease-in-out",
            isCollapsed ? "w-16" : "w-64",
          )}
        >
          {/* Brand Header */}
          <div
            className={cn(
              "flex h-16 items-center border-b border-border/70 px-3 shrink-0",
              isCollapsed ? "justify-center" : "justify-between px-4",
            )}
          >
            {!isCollapsed ? (
              <>
                <Link to="/dashboard" className="flex items-center gap-2 group overflow-hidden">
                  <img src={logo} width={140} height={110} alt="BidRadar" />
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-surface-muted shrink-0"
                  title="Collapse Sidebar"
                  aria-label="Collapse Sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary-soft shrink-0"
                    aria-label="Expand Sidebar"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand Sidebar</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Workspace Identity Module */}
          {!isCollapsed ? (
            <div className="p-3.5 border-b border-border/60 shrink-0">
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
          ) : (
            <div className="py-2.5 flex flex-col items-center border-b border-border/60 shrink-0">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-muted/50 hover:bg-surface-muted transition-colors text-primary">
                        <Building2 className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {companyProfile?.company_name || workspace?.name || "Workspace"} (
                    {completenessScore}% Calibrated)
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" side="right" className="w-56">
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
            </div>
          )}

          {/* Action CTA */}
          <div
            className={cn(
              "pt-3 pb-1 shrink-0",
              isCollapsed ? "px-2.5 flex justify-center" : "px-3.5",
            )}
          >
            {!isCollapsed ? (
              <Link
                to="/tenders/new"
                className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-bright shadow-subtle transition-all duration-150 active:scale-[0.98]"
              >
                <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Analyze a Tender</span>
              </Link>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/tenders/new"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-bright shadow-subtle transition-all active:scale-95"
                    aria-label="Analyze a Tender"
                  >
                    <PlusCircle className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Analyze a Tender</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Navigation Sections */}
          <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
            {/* Intelligence Section */}
            <div>
              {!isCollapsed && (
                <p className="px-2 pb-1.5 text-[10px] font-semibold text-muted-foreground font-mono uppercase tracking-wider">
                  Intelligence
                </p>
              )}
              <div className="space-y-1">
                {intelligenceNav.map((item) => {
                  const Icon = item.icon;
                  const linkElement = (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        "flex items-center rounded-lg text-xs font-medium transition-colors",
                        isCollapsed ? "h-9 w-9 mx-auto justify-center" : "gap-2.5 px-2.5 py-2",
                        item.active
                          ? "bg-primary-soft text-primary font-semibold"
                          : "text-text-secondary hover:text-foreground hover:bg-surface-muted",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          item.active ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {!isCollapsed && <span>{item.label}</span>}
                    </Link>
                  );

                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    );
                  }
                  return linkElement;
                })}
              </div>
            </div>

            {/* Organization Section */}
            <div>
              {!isCollapsed && (
                <p className="px-2 pb-1.5 text-[10px] font-semibold text-muted-foreground font-mono uppercase tracking-wider">
                  Organization
                </p>
              )}
              <div className="space-y-1">
                {organizationNav.map((item) => {
                  const Icon = item.icon;
                  const linkElement = (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        "flex items-center rounded-lg text-xs font-medium transition-colors",
                        isCollapsed ? "h-9 w-9 mx-auto justify-center" : "gap-2.5 px-2.5 py-2",
                        item.active
                          ? "bg-primary-soft text-primary font-semibold"
                          : "text-text-secondary hover:text-foreground hover:bg-surface-muted",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          item.active ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {!isCollapsed && <span>{item.label}</span>}
                    </Link>
                  );

                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    );
                  }
                  return linkElement;
                })}
              </div>
            </div>
          </nav>

          {/* User Footer */}
          <div className="p-3 border-t border-border/70 bg-surface shrink-0">
            {!isCollapsed ? (
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
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-nobid-soft shrink-0"
                  onClick={signOut}
                  title="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-7 w-7 rounded-full bg-primary-soft text-primary items-center justify-center font-mono text-xs font-bold cursor-default">
                      {user?.email?.slice(0, 2).toUpperCase() || "GB"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-semibold">{user?.email}</p>
                    <p className="text-[10px] opacity-80 uppercase">{role || "Member"}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-nobid-soft"
                      onClick={signOut}
                      aria-label="Sign Out"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign Out</TooltipContent>
                </Tooltip>
              </div>
            )}
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
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
