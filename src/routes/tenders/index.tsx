import React, { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  PlusCircle,
  Clock,
  Building2,
  Loader2,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Briefcase,
  X,
  MoreHorizontal,
  BarChart2,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Columns3,
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
type OpportunityAnalysis = Database["public"]["Tables"]["opportunity_analyses"]["Row"];

interface OpportunityListItem extends Opportunity {
  latest_analysis?: OpportunityAnalysis | null;
}

const PAGE_SIZE = 10;

interface KanbanColumnDef {
  id: string;
  title: string;
  statuses: Database["public"]["Enums"]["opportunity_status"][];
  badgeClass: string;
}

const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: "new",
    title: "1. Ingested & Analyzed",
    statuses: ["new", "analyzing", "analyzed"],
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
  },
  {
    id: "reviewing",
    title: "2. Under Review",
    statuses: ["reviewing"],
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
  },
  {
    id: "pursuing",
    title: "3. Bid Preparation",
    statuses: ["pursuing", "preparing"],
    badgeClass: "bg-primary-soft text-primary border-primary/25",
  },
  {
    id: "submitted",
    title: "4. Submitted",
    statuses: ["submitted"],
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25",
  },
  {
    id: "decided",
    title: "5. Closed / Awarded",
    statuses: ["won", "lost", "no_bid", "archived"],
    badgeClass: "bg-surface-muted text-muted-foreground border-border/80",
  },
];

export const Route = createFileRoute("/tenders/")({
  component: TendersListPage,
});

export function RecommendationBadge({ rec }: { rec?: string | null | undefined }) {
  if (!rec) {
    return (
      <Badge variant="outline" className="text-muted-foreground font-mono text-[10px] uppercase">
        PENDING
      </Badge>
    );
  }

  const normalized = rec.toLowerCase();
  if (normalized === "bid") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-bid-soft text-bid border border-bid/25 text-[11px] font-mono font-bold">
        <CheckCircle2 className="h-3 w-3" /> BID
      </span>
    );
  }
  if (normalized === "review") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-review-soft text-review border border-review/30 text-[11px] font-mono font-bold">
        <HelpCircle className="h-3 w-3" /> REVIEW
      </span>
    );
  }
  if (normalized === "no_bid" || normalized === "nobid") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-nobid-soft text-nobid border border-nobid/25 text-[11px] font-mono font-bold">
        <XCircle className="h-3 w-3" /> NO-BID
      </span>
    );
  }

  return (
    <Badge variant="outline" className="font-mono text-[10px] uppercase">
      {rec}
    </Badge>
  );
}

function PursuitBadge({
  status,
  override,
}: {
  status: string;
  override?: string | null | undefined;
}) {
  if (override === "bid" || status === "pursuing") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-soft text-primary border border-primary/20 text-[10px] font-mono font-semibold">
        <Briefcase className="h-2.5 w-2.5" /> PURSUING
      </span>
    );
  }
  if (override === "no_bid" || status === "no_bid") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-muted text-muted-foreground border border-border text-[10px] font-mono">
        ABANDONED
      </span>
    );
  }
  if (override === "review" || status === "reviewing") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-review-soft text-review border border-review/25 text-[10px] font-mono">
        IN REVIEW
      </span>
    );
  }
  return <span className="text-[10px] font-mono text-muted-foreground">UNDECIDED</span>;
}

function TendersListPage() {
  const { workspace } = useWorkspace();
  const [opportunities, setOpportunities] = useState<OpportunityListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "bid" | "review" | "no_bid" | "pursuing">(
    "all",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<OpportunityListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadOpportunities = useCallback(async () => {
    if (!workspace) return;
    setIsLoading(true);
    try {
      const { data: opps, error: oppErr } = await supabase
        .from("opportunities")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      if (oppErr) throw oppErr;

      if (!opps || opps.length === 0) {
        setOpportunities([]);
        setIsLoading(false);
        return;
      }

      const oppIds = opps.map((o) => o.id);
      const { data: analyses, error: anErr } = await supabase
        .from("opportunity_analyses")
        .select("*")
        .in("opportunity_id", oppIds)
        .order("version", { ascending: false });

      if (anErr) console.warn("[Tenders] Error loading analyses:", anErr.message);

      const merged: OpportunityListItem[] = opps.map((opp) => {
        const latest = analyses?.find((a) => a.opportunity_id === opp.id) ?? null;
        return { ...opp, latest_analysis: latest };
      });

      setOpportunities(merged);
    } catch (err) {
      console.error("[Tenders] Load failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  const handleDelete = async () => {
    if (!deleteTarget || !workspace) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("opportunities")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("workspace_id", workspace.id);

      if (error) throw error;
      toast.success(`"${deleteTarget.title}" has been deleted.`);
      setDeleteTarget(null);
      await loadOpportunities();
    } catch (err) {
      toast.error("Failed to delete tender", { description: (err as Error).message });
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = opportunities.filter((item) => {
    const matchesSearch =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.buyer && item.buyer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const rec = item.latest_analysis?.recommendation?.toLowerCase();
    const isPursuing = item.status === "pursuing" || item.latest_analysis?.human_override === "bid";

    let matchesTab = true;
    if (activeTab === "bid") matchesTab = rec === "bid";
    else if (activeTab === "review") matchesTab = rec === "review";
    else if (activeTab === "no_bid") matchesTab = rec === "no_bid" || rec === "nobid";
    else if (activeTab === "pursuing") matchesTab = isPursuing;

    return matchesSearch && matchesTab;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-primary">
                Contract Register
              </span>
              <span className="text-border-strong">•</span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {filtered.length} of {opportunities.length} Total
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Evaluated Tenders &amp; RFPs
            </h1>
          </div>
          <Button
            asChild
            className="bg-primary text-white hover:bg-primary-bright shadow-subtle h-9 text-xs"
          >
            <Link to="/tenders/new">
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Analyse New Tender
            </Link>
          </Button>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-surface border border-border">
            {[
              { id: "all", label: "All Tenders", count: opportunities.length },
              {
                id: "bid",
                label: "Qualified BID",
                count: opportunities.filter((o) => o.latest_analysis?.recommendation === "bid")
                  .length,
              },
              {
                id: "review",
                label: "REVIEW",
                count: opportunities.filter((o) => o.latest_analysis?.recommendation === "review")
                  .length,
              },
              {
                id: "no_bid",
                label: "NO-BID",
                count: opportunities.filter((o) => o.latest_analysis?.recommendation === "no_bid")
                  .length,
              },
              {
                id: "pursuing",
                label: "Pursuing",
                count: opportunities.filter(
                  (o) => o.status === "pursuing" || o.latest_analysis?.human_override === "bid",
                ).length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary text-white shadow-subtle font-semibold"
                    : "text-text-secondary hover:text-foreground hover:bg-surface-muted"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-surface-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Controls Right: Search + View Switcher */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search tender title or buyer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-9 text-xs rounded-lg border-border bg-surface"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface border border-border shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-white shadow-subtle font-semibold"
                    : "text-text-secondary hover:text-foreground hover:bg-surface-muted"
                }`}
                title="List Table View"
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === "kanban"
                    ? "bg-primary text-white shadow-subtle font-semibold"
                    : "text-text-secondary hover:text-foreground hover:bg-surface-muted"
                }`}
                title="Kanban Board View"
              >
                <Columns3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-xl border border-border">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-xs text-muted-foreground font-mono">Loading tender register...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground mx-auto">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-foreground">
                {searchQuery || activeTab !== "all"
                  ? "No Matching Contracts Found"
                  : "No Tenders Added Yet"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery || activeTab !== "all"
                  ? "Try resetting your search query or switching the status filter."
                  : "Add a tender document or URL to start evaluating your qualification and bid chances."}
              </p>
            </div>
            {!(searchQuery || activeTab !== "all") && (
              <Button asChild size="sm" className="bg-primary text-white hover:bg-primary-bright">
                <Link to="/tenders/new">
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Analyse First Tender
                </Link>
              </Button>
            )}
          </div>
        ) : viewMode === "list" ? (
          <div className="rounded-xl border border-border bg-surface shadow-subtle overflow-hidden">
            <Table className="min-w-[700px] w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%] min-w-[240px]">Tender Title &amp; Buyer</TableHead>
                  <TableHead className="w-[14%] min-w-[120px]">Recommendation</TableHead>
                  <TableHead className="w-[11%] min-w-[90px]">Score</TableHead>
                  <TableHead className="w-[12%] min-w-[100px]">Deadline</TableHead>
                  <TableHead className="w-[11%] min-w-[100px]">Pursuit</TableHead>
                  <TableHead className="w-[12%] min-w-[60px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((item) => {
                  const hasAnalysis = Boolean(item.latest_analysis);
                  const isProcessing = item.analysis_status === "processing";
                  const score = item.latest_analysis?.bidradar_score;
                  const confidence = item.latest_analysis?.confidence;

                  return (
                    <TableRow key={item.id} className="hover:bg-surface-muted/40 transition-colors">
                      <TableCell className="py-3 max-w-[260px] sm:max-w-sm md:max-w-md lg:max-w-lg">
                        <Link
                          to="/tenders/$id"
                          params={{ id: item.id }}
                          title={item.title}
                          className="font-display font-bold text-sm text-foreground hover:text-primary transition-colors line-clamp-2 break-words leading-snug"
                        >
                          {item.title}
                        </Link>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 min-w-0">
                          {item.buyer && (
                            <span
                              className="flex items-center gap-1 truncate max-w-[200px]"
                              title={item.buyer}
                            >
                              <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{item.buyer}</span>
                            </span>
                          )}
                          {item.source_type && (
                            <span className="font-mono text-[10px] uppercase bg-surface-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border/50 shrink-0">
                              {item.source_type}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        {isProcessing ? (
                          <span className="inline-flex items-center gap-1.5 text-primary text-xs font-mono font-semibold animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" /> ANALYZING...
                          </span>
                        ) : hasAnalysis ? (
                          <RecommendationBadge rec={item.latest_analysis?.recommendation} />
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground text-[10px] font-mono"
                          >
                            UNANALYZED
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="py-3 font-mono text-sm">
                        {score != null ? (
                          <div className="flex items-baseline gap-1">
                            <span className="font-bold text-foreground text-sm">{score}</span>
                            <span className="text-[10px] text-muted-foreground">/100</span>
                            {confidence != null && (
                              <span className="text-[10px] text-muted-foreground ml-1">
                                ({Math.round(Number(confidence) * 100)}%)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                        {item.deadline ? (
                          <div className="flex items-center gap-1 text-foreground">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{new Date(item.deadline).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span>Not stated</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        <PursuitBadge
                          status={item.status}
                          override={item.latest_analysis?.human_override}
                        />
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              aria-label="Tender actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                              <Link
                                to="/tenders/$id"
                                params={{ id: item.id }}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <BarChart2 className="h-3.5 w-3.5 text-primary" />
                                <span>View Analysis</span>
                              </Link>
                            </DropdownMenuItem>
                            {item.source_url && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={item.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>View Original</span>
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete Tender</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface">
                <span className="text-xs text-muted-foreground font-mono">
                  Page {currentPage} of {totalPages} &middot; {filtered.length} results
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "..." ? (
                        <span key={`ellipsis-${i}`} className="text-xs text-muted-foreground px-1">
                          …
                        </span>
                      ) : (
                        <Button
                          key={p}
                          variant={currentPage === p ? "default" : "outline"}
                          size="sm"
                          className="h-7 w-7 p-0 text-xs"
                          onClick={() => setCurrentPage(p as number)}
                        >
                          {p}
                        </Button>
                      ),
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ─── Kanban Board View ─── */
          <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[500px]">
            {KANBAN_COLUMNS.map((col) => {
              const columnItems = filtered.filter((item) =>
                col.statuses.includes(
                  item.status as Database["public"]["Enums"]["opportunity_status"],
                ),
              );

              return (
                <div
                  key={col.id}
                  className="flex flex-col min-w-[280px] sm:min-w-[300px] flex-1 bg-surface-muted/30 rounded-xl border border-border p-3.5 space-y-3"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-display font-bold text-xs text-foreground flex items-center gap-1.5">
                      {col.title}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${col.badgeClass}`}
                    >
                      {columnItems.length}
                    </span>
                  </div>

                  {/* Cards List */}
                  <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5">
                    {columnItems.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-border/60 rounded-lg bg-surface/30">
                        <p className="text-xs text-muted-foreground font-mono">
                          No tenders in stage
                        </p>
                      </div>
                    ) : (
                      columnItems.map((item) => {
                        const hasAnalysis = Boolean(item.latest_analysis);
                        const isProcessing = item.analysis_status === "processing";
                        const score = item.latest_analysis?.bidradar_score;

                        return (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-sm hover:border-primary/40 hover:shadow-subtle transition-all flex flex-col justify-between gap-3 group"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                {isProcessing ? (
                                  <span className="inline-flex items-center gap-1 text-primary text-[10px] font-mono font-semibold animate-pulse">
                                    <Loader2 className="h-3 w-3 animate-spin" /> ANALYZING
                                  </span>
                                ) : hasAnalysis ? (
                                  <RecommendationBadge rec={item.latest_analysis?.recommendation} />
                                ) : (
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    UNANALYZED
                                  </Badge>
                                )}

                                {score != null ? (
                                  <div className="flex items-baseline gap-0.5 font-mono text-xs">
                                    <span className="font-bold text-foreground">{score}</span>
                                    <span className="text-[10px] text-muted-foreground">/100</span>
                                  </div>
                                ) : null}
                              </div>

                              <Link
                                to="/tenders/$id"
                                params={{ id: item.id }}
                                className="font-display font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug block"
                                title={item.title}
                              >
                                {item.title}
                              </Link>

                              {item.buyer && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                                  <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="truncate">{item.buyer}</span>
                                </div>
                              )}
                            </div>

                            <div className="pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground font-mono">
                              <div className="flex items-center gap-1 text-[11px]">
                                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span>
                                  {item.deadline
                                    ? new Date(item.deadline).toLocaleDateString()
                                    : "No deadline"}
                                </span>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem asChild>
                                    <Link
                                      to="/tenders/$id"
                                      params={{ id: item.id }}
                                      className="flex items-center gap-2 cursor-pointer text-xs"
                                    >
                                      <BarChart2 className="h-3.5 w-3.5 text-primary" />
                                      <span>View Analysis</span>
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer text-xs"
                                    onClick={() => setDeleteTarget(item)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Delete Tender</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tender?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">{deleteTarget?.title}</strong> and all its
              analysis results will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Delete Tender
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
