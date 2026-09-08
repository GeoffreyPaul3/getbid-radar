import React, { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RecommendationBadge } from "./tenders/index";
import {
  PlusCircle,
  FileText,
  Clock,
  Building2,
  CheckCircle2,
  HelpCircle,
  XCircle,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Briefcase,
  Layers,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
type OpportunityAnalysis = Database["public"]["Tables"]["opportunity_analyses"]["Row"];
type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];

interface DashboardOpportunity extends Opportunity {
  latest_analysis?: OpportunityAnalysis | null;
}

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { workspace, companyProfile, completenessScore } = useWorkspace();
  const [opportunities, setOpportunities] = useState<DashboardOpportunity[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!workspace) return;
      setIsLoading(true);
      try {
        const { data: opps, error: oppErr } = await supabase
          .from("opportunities")
          .select("*")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false });

        if (oppErr) throw oppErr;

        // Fetch recent activity logs
        const { data: logs } = await supabase
          .from("activity_logs")
          .select("*")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false })
          .limit(8);

        setActivityLogs(logs ?? []);

        if (!opps || opps.length === 0) {
          setOpportunities([]);
          setIsLoading(false);
          return;
        }

        const oppIds = opps.map((o) => o.id);
        const { data: analyses } = await supabase
          .from("opportunity_analyses")
          .select("*")
          .in("opportunity_id", oppIds)
          .order("version", { ascending: false });

        const merged: DashboardOpportunity[] = opps.map((opp) => {
          const latest = analyses?.find((a) => a.opportunity_id === opp.id) ?? null;
          return {
            ...opp,
            latest_analysis: latest,
          };
        });

        setOpportunities(merged);
      } catch (err) {
        console.error("[Dashboard] Load failed:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, [workspace]);

  const totalOpps = opportunities.length;
  const bidCount = opportunities.filter((o) => o.latest_analysis?.recommendation === "bid").length;
  const reviewCount = opportunities.filter(
    (o) => o.latest_analysis?.recommendation === "review",
  ).length;
  const noBidCount = opportunities.filter(
    (o) => o.latest_analysis?.recommendation === "no_bid",
  ).length;
  const pursuingCount = opportunities.filter((o) => o.status === "pursuing").length;

  const recentTenders = opportunities.slice(0, 5);
  const needingAttention = opportunities
    .filter(
      (o) =>
        o.latest_analysis?.recommendation === "review" ||
        (o.latest_analysis?.critical_blockers as string[] | undefined)?.length ||
        (o.deadline && new Date(o.deadline).getTime() - Date.now() < 14 * 24 * 3600 * 1000),
    )
    .slice(0, 4);

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              Procurement Intelligence Radar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {companyProfile?.company_name || workspace?.name || "Workspace"} • Live qualification
              status and pipeline health.
            </p>
          </div>
          <Button asChild className="bg-primary text-primary-foreground">
            <Link to="/tenders/new">
              <PlusCircle className="h-4 w-4 mr-2" /> Ingest New Tender
            </Link>
          </Button>
        </div>

        {/* Profile Readiness Banner if incomplete */}
        {completenessScore < 80 && (
          <div className="p-4 rounded-xl border border-accent/30 bg-accent/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground shrink-0 font-mono text-xs font-bold">
                {completenessScore}%
              </div>
              <div>
                <p className="font-display font-semibold text-xs text-foreground">
                  Enhance Evidence Base Readiness
                </p>
                <p className="text-xs text-muted-foreground">
                  Complete your corporate commercial parameters and past projects to improve
                  qualification match confidence.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="text-xs shrink-0 font-mono">
              <Link to="/settings">Calibrate Profile</Link>
            </Button>
          </div>
        )}

        {/* Real KPI Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-border/80 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">
                Total Ingested
              </span>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-display text-3xl font-bold text-foreground mt-2">{totalOpps}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tenders under radar</p>
          </Card>

          <Card className="border border-bid/30 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">
                Qualified BID
              </span>
              <CheckCircle2 className="h-4 w-4 text-bid" />
            </div>
            <p className="font-display text-3xl font-bold text-bid mt-2">{bidCount}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
              {totalOpps > 0 ? Math.round((bidCount / totalOpps) * 100) : 0}% of pipeline
            </p>
          </Card>

          <Card className="border border-review/30 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">
                Require REVIEW
              </span>
              <HelpCircle className="h-4 w-4 text-review" />
            </div>
            <p className="font-display text-3xl font-bold text-review mt-2">{reviewCount}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Conditioned pursuit</p>
          </Card>

          <Card className="border border-nobid/30 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">
                Recommended NO-BID
              </span>
              <XCircle className="h-4 w-4 text-nobid" />
            </div>
            <p className="font-display text-3xl font-bold text-nobid mt-2">{noBidCount}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Avoided risk</p>
          </Card>
        </div>

        {/* Empty State vs Pipeline Tables */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-card rounded-xl border border-border">
            <Loader2 className="h-8 w-8 animate-spin text-accent mb-2" />
            <p className="text-xs text-muted-foreground font-mono">
              Loading pipeline intelligence...
            </p>
          </div>
        ) : totalOpps === 0 ? (
          <Card className="border border-border/80 shadow-panel bg-card text-center p-12 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground mx-auto">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg text-foreground">
                Your Procurement Radar is Clean
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                No tenders have been evaluated yet. Ingest a procurement specification package or
                URL to view instant requirements compliance and qualification scoring.
              </p>
            </div>
            <Button asChild className="bg-primary text-primary-foreground font-medium">
              <Link to="/tenders/new">
                <PlusCircle className="h-4 w-4 mr-1.5" /> Ingest First Tender
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recently Analyzed Tenders (2 cols) */}
            <Card className="lg:col-span-2 border border-border/80 shadow-panel bg-card">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-display text-base">
                    Recently Evaluated Tenders
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Latest RFPs processed through the Phase 2 analysis engine.
                  </CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <Link to="/tenders">View All ({totalOpps})</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {recentTenders.map((opp) => {
                  const score = opp.latest_analysis?.bidradar_score;
                  const rec = opp.latest_analysis?.recommendation;

                  return (
                    <div
                      key={opp.id}
                      className="p-3.5 rounded-xl border border-border/60 bg-surface/40 hover:bg-surface/70 transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <Link
                          to="/tenders/$id"
                          params={{ id: opp.id }}
                          className="font-display font-semibold text-sm text-foreground hover:text-accent truncate block"
                        >
                          {opp.title}
                        </Link>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                          {opp.buyer && (
                            <span className="flex items-center gap-1 truncate">
                              <Building2 className="h-3 w-3" /> {opp.buyer}
                            </span>
                          )}
                          {opp.deadline && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(opp.deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {score != null ? (
                          <div className="text-right font-mono">
                            <span className="font-bold text-sm text-foreground">{score}</span>
                            <span className="text-[10px] text-muted-foreground">/100</span>
                          </div>
                        ) : null}
                        <RecommendationBadge rec={rec} />
                        <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                          <Link to="/tenders/$id" params={{ id: opp.id }}>
                            Report <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Opportunities Needing Attention (1 col) */}
            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-review" /> Needs Attention
                </CardTitle>
                <CardDescription className="text-xs">
                  Tenders with conditional reviews or imminent deadlines.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {needingAttention.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">
                    All evaluated opportunities are clear.
                  </p>
                ) : (
                  needingAttention.map((opp) => (
                    <div
                      key={opp.id}
                      className="p-3 rounded-lg border border-border/60 bg-surface/50 space-y-1.5"
                    >
                      <Link
                        to="/tenders/$id"
                        params={{ id: opp.id }}
                        className="font-semibold text-xs text-foreground hover:text-accent truncate block"
                      >
                        {opp.title}
                      </Link>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <RecommendationBadge rec={opp.latest_analysis?.recommendation} />
                        {opp.deadline && (
                          <span className="font-mono">
                            Due {new Date(opp.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Real Activity Stream */}
        {activityLogs.length > 0 && (
          <Card className="border border-border/80 shadow-panel bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">
                Recent Audit & Pipeline Activity
              </CardTitle>
              <CardDescription className="text-xs">
                Immutable event stream logged by the workspace qualification engine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-border/60 bg-surface/30 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 truncate">
                      <span className="font-mono font-bold text-[11px] uppercase text-accent truncate block">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate block">
                        Resource: {log.resource_type || "pipeline"} • {log.resource_id?.slice(0, 8)}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
