import React, { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  PlusCircle,
  FileText,
  Clock,
  Building2,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
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
      <Badge variant="outline" className="text-muted-foreground font-mono text-[11px]">
        PENDING
      </Badge>
    );
  }

  const normalized = rec.toLowerCase();
  if (normalized === "bid") {
    return (
      <Badge className="bg-bid text-bid-foreground font-mono font-bold text-[11px] px-2.5 py-0.5 border-0 shadow-sm flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> BID
      </Badge>
    );
  }
  if (normalized === "review") {
    return (
      <Badge className="bg-review text-review-foreground font-mono font-bold text-[11px] px-2.5 py-0.5 border-0 shadow-sm flex items-center gap-1">
        <HelpCircle className="h-3 w-3" /> REVIEW
      </Badge>
    );
  }
  if (normalized === "no_bid" || normalized === "nobid") {
    return (
      <Badge className="bg-nobid text-nobid-foreground font-mono font-bold text-[11px] px-2.5 py-0.5 border-0 shadow-sm flex items-center gap-1">
        <XCircle className="h-3 w-3" /> NO-BID
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="font-mono text-[11px] uppercase">
      {rec}
    </Badge>
  );
}

function TendersListPage() {
  const { workspace } = useWorkspace();
  const [opportunities, setOpportunities] = useState<OpportunityListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

        // Fetch latest analysis for each opportunity
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

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "analyzing" && item.analysis_status === "processing") ||
      (statusFilter === "bid" && item.latest_analysis?.recommendation === "bid") ||
      (statusFilter === "review" && item.latest_analysis?.recommendation === "review") ||
      (statusFilter === "no_bid" && item.latest_analysis?.recommendation === "no_bid") ||
      item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              Tender Register
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Active procurement notices evaluated by the deterministic qualification engine.
            </p>
          </div>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/tenders/new">
              <PlusCircle className="h-4 w-4 mr-2" /> Ingest Tender
            </Link>
          </Button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by tender title, issuing buyer, or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-card"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 h-10 bg-card">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenders</SelectItem>
              <SelectItem value="bid">Recommendation: BID</SelectItem>
              <SelectItem value="review">Recommendation: REVIEW</SelectItem>
              <SelectItem value="no_bid">Recommendation: NO-BID</SelectItem>
              <SelectItem value="analyzing">Analyzing...</SelectItem>
              <SelectItem value="pursuing">Pursuing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content Table or Empty State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-card rounded-xl border border-border">
            <Loader2 className="h-8 w-8 animate-spin text-accent mb-2" />
            <p className="text-xs text-muted-foreground font-mono">Loading tender register...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border border-border/80 shadow-panel bg-card text-center p-12">
            <CardContent className="space-y-4 p-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground mx-auto">
                <FileText className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-base text-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "No matching tenders found"
                    : "No tenders ingested yet"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {searchQuery || statusFilter !== "all"
                    ? "Adjust your search terms or filter criteria."
                    : "Begin by uploading a tender document package (PDF/DOCX) or pasting a procurement portal URL."}
                </p>
              </div>
              <Button asChild className="mt-2">
                <Link to="/tenders/new">
                  <PlusCircle className="h-4 w-4 mr-2" /> Ingest First Tender
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
            <Table>
              <TableHeader className="bg-surface/50">
                <TableRow>
                  <TableHead className="font-mono text-xs font-semibold">
                    Tender Title & Buyer
                  </TableHead>
                  <TableHead className="font-mono text-xs font-semibold">Recommendation</TableHead>
                  <TableHead className="font-mono text-xs font-semibold">Score</TableHead>
                  <TableHead className="font-mono text-xs font-semibold">Deadline</TableHead>
                  <TableHead className="font-mono text-xs font-semibold">Status</TableHead>
                  <TableHead className="font-mono text-xs font-semibold text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const hasAnalysis = Boolean(item.latest_analysis);
                  const isProcessing = item.analysis_status === "processing";
                  const score = item.latest_analysis?.bidradar_score;
                  const confidence = item.latest_analysis?.confidence;

                  return (
                    <TableRow key={item.id} className="hover:bg-surface/40 transition-colors">
                      <TableCell className="py-3.5 max-w-md">
                        <Link
                          to="/tenders/$id"
                          params={{ id: item.id }}
                          className="font-display font-semibold text-sm text-foreground hover:text-accent transition-colors block truncate"
                        >
                          {item.title}
                        </Link>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {item.buyer && (
                            <span className="flex items-center gap-1 truncate">
                              <Building2 className="h-3 w-3" /> {item.buyer}
                            </span>
                          )}
                          {item.source_type && (
                            <span className="font-mono text-[10px] uppercase bg-secondary px-1.5 py-0.5 rounded">
                              {item.source_type}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5">
                        {isProcessing ? (
                          <Badge
                            variant="outline"
                            className="text-accent font-mono text-[11px] animate-pulse"
                          >
                            ANALYZING...
                          </Badge>
                        ) : hasAnalysis ? (
                          <RecommendationBadge rec={item.latest_analysis?.recommendation} />
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground text-[11px] font-mono"
                          >
                            UNANALYZED
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 font-mono text-sm">
                        {score != null ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground">{score}</span>
                            <span className="text-xs text-muted-foreground">/ 100</span>
                            {confidence != null && (
                              <span className="text-[10px] text-muted-foreground">
                                ({Math.round(Number(confidence) * 100)}% conf)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 text-xs text-muted-foreground font-mono">
                        {item.deadline ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.deadline).toLocaleDateString()}
                          </div>
                        ) : (
                          <span>Not stated</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5">
                        <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                          {item.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-3.5 text-right">
                        <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                          <Link to="/tenders/$id" params={{ id: item.id }}>
                            View Report <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
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
