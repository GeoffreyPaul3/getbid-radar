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
  Activity,
  ChevronRight,
  ShieldAlert,
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
  const pendingCount = totalOpps - (bidCount + reviewCount + noBidCount);
  const pursuingCount = opportunities.filter((o) => o.status === "pursuing").length;

  const bidPercent = totalOpps > 0 ? Math.round((bidCount / totalOpps) * 100) : 0;
  const reviewPercent = totalOpps > 0 ? Math.round((reviewCount / totalOpps) * 100) : 0;
  const noBidPercent = totalOpps > 0 ? Math.round((noBidCount / totalOpps) * 100) : 0;
  const pendingPercent =
    totalOpps > 0 ? Math.max(0, 100 - (bidPercent + reviewPercent + noBidPercent)) : 0;

  const recentTenders = opportunities.slice(0, 6);

  // Attention items: critical blockers, deadlines within 7 days, or reviews
  const needingAttention = opportunities
    .filter((o) => {
      const isReview = o.latest_analysis?.recommendation === "review";
      const hasBlockers = (o.latest_analysis?.critical_blockers as unknown[] | undefined)?.length;
      const isUrgent =
        o.deadline &&
        new Date(o.deadline).getTime() - Date.now() > 0 &&
        new Date(o.deadline).getTime() - Date.now() < 7 * 24 * 3600 * 1000;
      return isReview || hasBlockers || isUrgent;
    })
    .slice(0, 4);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Intelligence Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-primary">
                Executive Command Center
              </span>
              <span className="text-border-strong">•</span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {companyProfile?.company_name || workspace?.name || "Workspace"}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Contract Intelligence Overview
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <Button asChild variant="outline" size="sm" className="text-xs h-9">
              <Link to="/tenders">View All Tenders</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="text-xs h-9 bg-primary text-white hover:bg-primary-bright"
            >
              <Link to="/tenders/new">
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Analyze a Tender
              </Link>
            </Button>
          </div>
        </div>

        {/* Evidence Calibration Alert if Profile Incomplete */}
        {completenessScore < 80 && (
          <div className="p-4 rounded-xl border border-primary/20 bg-primary-soft/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shrink-0 font-mono text-xs font-bold shadow-subtle">
                {completenessScore}%
              </div>
              <div>
                <p className="font-display font-semibold text-xs text-foreground">
                  Evidence Calibration Needed
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Complete your company parameters, past contract scales, and certifications to
                  increase AI qualification confidence.
                </p>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="text-xs shrink-0 font-medium bg-surface"
            >
              <Link to="/settings">Calibrate Profile</Link>
            </Button>
          </div>
        )}

        {/* Executive KPI Modules */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* Total */}
          <div className="p-4 rounded-xl border border-border bg-surface shadow-subtle flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="label-caps">Total Analyzed</span>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3">
              <p className="font-display text-2xl sm:text-3xl font-bold text-foreground numeric">
                {totalOpps}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Evaluated tenders</p>
            </div>
          </div>

          {/* Qualified BID */}
          <div className="p-4 rounded-xl border border-bid/25 bg-surface shadow-subtle flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="label-caps text-bid">Qualified BID</span>
              <CheckCircle2 className="h-4 w-4 text-bid" />
            </div>
            <div className="mt-3">
              <p className="font-display text-2xl sm:text-3xl font-bold text-bid numeric">
                {bidCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                {bidPercent}% of pipeline
              </p>
            </div>
          </div>

          {/* Requires REVIEW */}
          <div className="p-4 rounded-xl border border-review/30 bg-surface shadow-subtle flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="label-caps text-review">Under Review</span>
              <HelpCircle className="h-4 w-4 text-review" />
            </div>
            <div className="mt-3">
              <p className="font-display text-2xl sm:text-3xl font-bold text-review numeric">
                {reviewCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                {reviewPercent}% conditional
              </p>
            </div>
          </div>

          {/* Recommended NO-BID */}
          <div className="p-4 rounded-xl border border-nobid/25 bg-surface shadow-subtle flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="label-caps text-nobid">Avoided NO-BID</span>
              <XCircle className="h-4 w-4 text-nobid" />
            </div>
            <div className="mt-3">
              <p className="font-display text-2xl sm:text-3xl font-bold text-nobid numeric">
                {noBidCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                {noBidPercent}% non-viable
              </p>
            </div>
          </div>

          {/* Active Pursuits */}
          <div className="col-span-2 md:col-span-1 p-4 rounded-xl border border-primary/25 bg-surface shadow-subtle flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="label-caps text-primary">Active Pursuits</span>
              <Briefcase className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3">
              <p className="font-display text-2xl sm:text-3xl font-bold text-primary numeric">
                {pursuingCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Bid workspaces</p>
            </div>
          </div>
        </div>

        {/* Decision Pipeline Distribution Bar */}
        {totalOpps > 0 && (
          <div className="p-4 rounded-xl border border-border bg-surface shadow-subtle space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Decision Pipeline Distribution</span>
              <span className="text-muted-foreground font-mono text-[11px]">
                {totalOpps} Total Opportunities
              </span>
            </div>

            {/* Segmented Bar */}
            <div className="w-full h-3 rounded-full bg-surface-muted overflow-hidden flex border border-border/50">
              {bidPercent > 0 && (
                <div
                  className="bg-bid transition-all duration-500"
                  style={{ width: `${bidPercent}%` }}
                  title={`BID: ${bidCount} (${bidPercent}%)`}
                />
              )}
              {reviewPercent > 0 && (
                <div
                  className="bg-review transition-all duration-500"
                  style={{ width: `${reviewPercent}%` }}
                  title={`REVIEW: ${reviewCount} (${reviewPercent}%)`}
                />
              )}
              {noBidPercent > 0 && (
                <div
                  className="bg-nobid transition-all duration-500"
                  style={{ width: `${noBidPercent}%` }}
                  title={`NO-BID: ${noBidCount} (${noBidPercent}%)`}
                />
              )}
              {pendingPercent > 0 && (
                <div
                  className="bg-border-strong transition-all duration-500"
                  style={{ width: `${pendingPercent}%` }}
                  title={`PENDING: ${pendingCount} (${pendingPercent}%)`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-bid" />
                <span className="text-text-secondary">
                  BID: {bidCount} ({bidPercent}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-review" />
                <span className="text-text-secondary">
                  REVIEW: {reviewCount} ({reviewPercent}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-nobid" />
                <span className="text-text-secondary">
                  NO-BID: {noBidCount} ({noBidPercent}%)
                </span>
              </div>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
                  <span className="text-text-secondary">PENDING: {pendingCount}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State vs Pipeline Tables */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-xl border border-border">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-xs text-muted-foreground font-mono">
              Loading pipeline intelligence...
            </p>
          </div>
        ) : totalOpps === 0 ? (
          <Card className="border border-border shadow-panel bg-surface text-center p-10 sm:p-14 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary mx-auto shadow-subtle">
              <Layers className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="font-display font-bold text-xl text-foreground">
                No Tenders Analyzed Yet
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary mt-1.5 leading-relaxed">
                Upload your first tender document or provide an RFP URL. GetBidRadar will evaluate
                its requirements against your company evidence and compute an objective
                qualification decision.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                asChild
                className="bg-primary text-white hover:bg-primary-bright shadow-subtle"
              >
                <Link to="/tenders/new">
                  <PlusCircle className="h-4 w-4 mr-1.5" /> Analyze First Tender
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/knowledge">Upload Company Evidence</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recently Analyzed Tenders (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface shadow-subtle">
                <div className="flex items-center justify-between pb-3.5 border-b border-border/70 mb-3">
                  <div>
                    <h2 className="font-display font-bold text-base text-foreground">
                      Recently Evaluated Contracts
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Latest procurement opportunities processed through the qualification engine.
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="text-xs">
                    <Link to="/tenders">View All ({totalOpps})</Link>
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {recentTenders.map((opp) => {
                    const score = opp.latest_analysis?.bidradar_score;
                    const rec = opp.latest_analysis?.recommendation;

                    return (
                      <div
                        key={opp.id}
                        className="p-3 sm:p-3.5 rounded-lg border border-border/60 bg-surface hover:bg-surface-muted/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <Link
                            to="/tenders/$id"
                            params={{ id: opp.id }}
                            className="font-display font-bold text-sm text-foreground hover:text-primary transition-colors truncate block"
                          >
                            {opp.title}
                          </Link>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
                            {opp.buyer && (
                              <span className="flex items-center gap-1 truncate">
                                <Building2 className="h-3 w-3 text-muted-foreground" /> {opp.buyer}
                              </span>
                            )}
                            {opp.deadline && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {new Date(opp.deadline).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                          {score != null ? (
                            <div className="text-right font-mono">
                              <span className="font-bold text-sm text-foreground">{score}</span>
                              <span className="text-[10px] text-muted-foreground">/100</span>
                            </div>
                          ) : null}
                          <RecommendationBadge rec={rec} />
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold"
                          >
                            <Link to="/tenders/$id" params={{ id: opp.id }}>
                              Report <ChevronRight className="h-3 w-3 ml-0.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Opportunities Needing Attention (1 col) */}
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface shadow-subtle space-y-3">
                <div className="pb-3 border-b border-border/70">
                  <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-review" /> Attention Required
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Conditional evaluations or upcoming deadlines.
                  </p>
                </div>

                {needingAttention.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">
                    All evaluated opportunities are clear.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {needingAttention.map((opp) => (
                      <div
                        key={opp.id}
                        className="p-3 rounded-lg border border-border/60 bg-surface-muted/40 hover:bg-surface-muted transition-colors space-y-1.5"
                      >
                        <Link
                          to="/tenders/$id"
                          params={{ id: opp.id }}
                          className="font-semibold text-xs text-foreground hover:text-primary transition-colors truncate block"
                        >
                          {opp.title}
                        </Link>
                        <div className="flex items-center justify-between text-[11px]">
                          <RecommendationBadge rec={opp.latest_analysis?.recommendation} />
                          {opp.deadline && (
                            <span className="font-mono text-muted-foreground text-[10px]">
                              Due {new Date(opp.deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Company Evidence Quick Status */}
              <div className="p-4 rounded-xl border border-border bg-surface shadow-subtle">
                <div className="flex items-center justify-between pb-2 border-b border-border/60 mb-2.5">
                  <span className="text-xs font-semibold text-foreground">
                    Company Evidence Status
                  </span>
                  <Link
                    to="/knowledge"
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Manage →
                  </Link>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Evidence Calibration</span>
                    <span className="font-mono font-bold text-foreground">
                      {completenessScore}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Active Workspace</span>
                    <span className="font-medium text-foreground truncate max-w-[140px]">
                      {workspace?.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Real Activity Stream from activity_logs */}
        {activityLogs.length > 0 && (
          <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface shadow-subtle">
            <div className="pb-3 border-b border-border/70 mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Recent Qualification Audit Stream
                </h2>
                <p className="text-xs text-muted-foreground">
                  Immutable event stream logged by the workspace qualification engine.
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground">Audit Trail</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg border border-border/60 bg-surface-muted/30 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 truncate">
                    <span className="font-mono font-bold text-[11px] uppercase text-primary truncate block">
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block font-mono">
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
          </div>
        )}
      </div>
    </AppShell>
  );
}
