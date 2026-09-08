import React, { useState, useEffect } from "react";
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
  Search,
  PlusCircle,
  FileText,
  Clock,
  Building2,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Briefcase,
  X,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
type OpportunityAnalysis = Database["public"]["Tables"]["opportunity_analyses"]["Row"];

interface OpportunityListItem extends Opportunity {
  latest_analysis?: OpportunityAnalysis | null;
}

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

  useEffect(() => {
    async function loadOpportunities() {
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
          return {
            ...opp,
            latest_analysis: latest,
          };
        });

        setOpportunities(merged);
      } catch (err) {
        console.error("[Tenders] Load failed:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadOpportunities();
  }, [workspace]);

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
              Evaluated Tenders & RFPs
            </h1>
          </div>
          <Button
            asChild
            className="bg-primary text-white hover:bg-primary-bright shadow-subtle h-9 text-xs"
          >
            <Link to="/tenders/new">
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Ingest Tender
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
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
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

          {/* Search Bar */}
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
        </div>

        {/* Operational Table */}
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
                  : "No Tenders Ingested Yet"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery || activeTab !== "all"
                  ? "Try resetting your search query or switching the status filter."
                  : "Ingest a tender document package or public URL to view deterministic qualification results."}
              </p>
            </div>
            {!(searchQuery || activeTab !== "all") && (
              <Button asChild size="sm" className="bg-primary text-white hover:bg-primary-bright">
                <Link to="/tenders/new">
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Ingest First Tender
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface shadow-subtle overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[38%]">Tender Title & Buyer</TableHead>
                  <TableHead className="w-[14%]">Recommendation</TableHead>
                  <TableHead className="w-[12%]">Score</TableHead>
                  <TableHead className="w-[12%]">Deadline</TableHead>
                  <TableHead className="w-[12%]">Pursuit</TableHead>
                  <TableHead className="w-[12%] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const hasAnalysis = Boolean(item.latest_analysis);
                  const isProcessing = item.analysis_status === "processing";
                  const score = item.latest_analysis?.bidradar_score;
                  const confidence = item.latest_analysis?.confidence;

                  return (
                    <TableRow key={item.id} className="hover:bg-surface-muted/40 transition-colors">
                      <TableCell className="py-3">
                        <Link
                          to="/tenders/$id"
                          params={{ id: item.id }}
                          className="font-display font-bold text-sm text-foreground hover:text-primary transition-colors block truncate"
                        >
                          {item.title}
                        </Link>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {item.buyer && (
                            <span className="flex items-center gap-1 truncate">
                              <Building2 className="h-3 w-3 text-muted-foreground" /> {item.buyer}
                            </span>
                          )}
                          {item.source_type && (
                            <span className="font-mono text-[10px] uppercase bg-surface-muted text-muted-foreground px-1.5 py-0.2 rounded border border-border/50">
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
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 text-xs font-semibold"
                        >
                          <Link to="/tenders/$id" params={{ id: item.id }}>
                            Intelligence <ChevronRight className="h-3 w-3 ml-0.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
