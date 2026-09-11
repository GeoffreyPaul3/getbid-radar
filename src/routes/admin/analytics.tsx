import React, { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  FileText,
  ShieldAlert,
  Target,
  Loader2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { getAdminAnalyticsFn, type AdminAnalyticsData } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalyticsPage,
});

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:         { label: "New",          color: "bg-primary/60" },
  analyzing:   { label: "Analyzing",   color: "bg-amber-500/60" },
  analyzed:    { label: "Analyzed",    color: "bg-bid/70" },
  reviewing:   { label: "Reviewing",   color: "bg-accent/60" },
  pursuing:    { label: "Pursuing",    color: "bg-bid" },
  no_bid:      { label: "No-Bid",      color: "bg-destructive/60" },
  preparing:   { label: "Preparing",   color: "bg-amber-600/60" },
  submitted:   { label: "Submitted",   color: "bg-primary" },
  won:         { label: "Won",         color: "bg-bid" },
  lost:        { label: "Lost",        color: "bg-destructive/50" },
  archived:    { label: "Archived",    color: "bg-muted-foreground/40" },
};

function AdminAnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminAnalyticsFn({ data: { adminUserId: user.id } });
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const totalOpportunities = analytics
    ? Object.values(analytics.opportunityStatusCounts).reduce((a, b) => a + b, 0)
    : 0;

  const wonCount = analytics?.opportunityStatusCounts["won"] || 0;
  const submittedCount = analytics?.opportunityStatusCounts["submitted"] || 0;
  const winRate = submittedCount > 0 ? Math.round((wonCount / submittedCount) * 100) : 0;

  return (
    <AdminShell
      title="Platform Analytics"
      description="Aggregate platform engagement, opportunity pipeline, and compliance health across all tenants."
    >
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-xs gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Aggregating platform analytics...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-xs text-destructive flex items-center justify-between">
            <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>
            <Button size="sm" variant="outline" onClick={fetchAnalytics} className="text-xs">Retry</Button>
          </div>
        ) : analytics ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border border-border bg-surface shadow-subtle p-5">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-xs font-medium">Total Opportunities</span>
                  <div className="p-2 rounded-lg bg-primary-soft text-primary"><FileText className="h-4 w-4" /></div>
                </div>
                <div className="font-display font-extrabold text-2xl text-foreground">{totalOpportunities}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Across all workspace tenants</p>
              </Card>
              <Card className="border border-border bg-surface shadow-subtle p-5">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-xs font-medium">Compliance Audits</span>
                  <div className="p-2 rounded-lg bg-primary-soft text-primary"><ShieldAlert className="h-4 w-4" /></div>
                </div>
                <div className="font-display font-extrabold text-2xl text-foreground">{analytics.totalAudits}</div>
                <p className="text-[11px] text-muted-foreground mt-1">{analytics.totalFindings} total findings logged</p>
              </Card>
              <Card className="border border-border bg-surface shadow-subtle p-5">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-xs font-medium">Avg. Readiness Score</span>
                  <div className="p-2 rounded-lg bg-primary-soft text-primary"><Target className="h-4 w-4" /></div>
                </div>
                <div className="font-display font-extrabold text-2xl text-foreground">
                  {analytics.totalAudits > 0 ? `${analytics.averageReadinessScore}` : "—"}
                  {analytics.totalAudits > 0 && <span className="text-base font-normal text-muted-foreground">/100</span>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Compliance readiness average</p>
              </Card>
              <Card className="border border-border bg-surface shadow-subtle p-5">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-xs font-medium">Platform Win Rate</span>
                  <div className="p-2 rounded-lg bg-primary-soft text-primary"><TrendingUp className="h-4 w-4" /></div>
                </div>
                <div className="font-display font-extrabold text-2xl text-bid">
                  {submittedCount > 0 ? `${winRate}%` : "—"}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {wonCount} won / {submittedCount} submitted
                </p>
              </Card>
            </div>

            {/* Opportunity Status Distribution */}
            <Card className="border border-border bg-surface shadow-subtle">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Opportunity Pipeline</CardTitle>
                  <CardDescription className="text-xs">Status distribution of all tender opportunities platform-wide.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchAnalytics} disabled={loading} className="text-xs h-8">
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {Object.keys(analytics.opportunityStatusCounts).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No opportunity data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(analytics.opportunityStatusCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([status, count]) => {
                        const pct = totalOpportunities > 0 ? Math.round((count / totalOpportunities) * 100) : 0;
                        const meta = STATUS_LABELS[status] || { label: status, color: "bg-muted-foreground/40" };
                        return (
                          <div key={status} className="space-y-1 text-xs">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className={`h-2.5 w-2.5 rounded-full ${meta.color}`} />
                                <span className="font-medium text-foreground">{meta.label}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-foreground font-semibold">{count}</span>
                                <Badge variant="outline" className="font-mono text-[10px] w-12 justify-center">{pct}%</Badge>
                              </div>
                            </div>
                            <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${meta.color}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compliance Summary */}
            <Card className="border border-border bg-surface shadow-subtle">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Compliance & Audit Health</CardTitle>
                <CardDescription className="text-xs">Platform-wide compliance audit summary and readiness metrics.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-mono text-muted-foreground">Total Audits Run</p>
                    <p className="font-display font-bold text-3xl text-foreground">{analytics.totalAudits}</p>
                    <p className="text-[11px] text-muted-foreground">Compliance checks performed</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-mono text-muted-foreground">Total Findings</p>
                    <p className="font-display font-bold text-3xl text-foreground">{analytics.totalFindings}</p>
                    <p className="text-[11px] text-muted-foreground">Compliance issues identified</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-mono text-muted-foreground">Average Readiness</p>
                    <div className="flex items-end gap-2">
                      <p className="font-display font-bold text-3xl text-bid">
                        {analytics.totalAudits > 0 ? analytics.averageReadinessScore : "—"}
                      </p>
                      {analytics.totalAudits > 0 && <p className="text-sm text-muted-foreground mb-1">/100</p>}
                    </div>
                    {analytics.totalAudits > 0 && (
                      <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-bid transition-all"
                          style={{ width: `${analytics.averageReadinessScore}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
