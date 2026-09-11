import React, { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  FileText,
  CreditCard,
  TrendingUp,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  Send,
} from "lucide-react";
import {
  getAdminOverviewMetricsFn,
  type AdminOverviewMetrics,
} from "@/lib/admin/admin.functions";
import { formatBillingAmount } from "@/lib/billing/plans";

export const Route = createFileRoute("/admin/")({
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    getAdminOverviewMetricsFn()
      .then((data) => setMetrics(data))
      .catch((err) => setError(err.message || "Failed to load metrics."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMetrics();
  }, [user?.id]);

  return (
    <AdminShell
      title="Platform Operations Overview"
      description="Live multi-tenant platform metrics, commercial adoption, and system activity."
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-xs gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Aggregating platform metrics...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={fetchMetrics} className="text-xs">
            Retry
          </Button>
        </div>
      ) : metrics ? (
        <div className="space-y-8">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-border bg-surface shadow-subtle p-5">
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-xs font-medium">Estimated MRR</span>
                <div className="p-2 rounded-lg bg-primary-soft text-primary">
                  <CreditCard className="h-4 w-4" />
                </div>
              </div>
              <div className="font-display font-extrabold text-2xl text-foreground">
                ${metrics.estimatedMRR_USD.toLocaleString()}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Active paid monthly subscriptions
              </p>
            </Card>

            <Card className="border border-border bg-surface shadow-subtle p-5">
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-xs font-medium">Total Companies</span>
                <div className="p-2 rounded-lg bg-primary-soft text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
              <div className="font-display font-extrabold text-2xl text-foreground">
                {metrics.totalWorkspaces}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {metrics.activeTrials} in 14-day evaluation
              </p>
            </Card>

            <Card className="border border-border bg-surface shadow-subtle p-5">
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-xs font-medium">Total Users</span>
                <div className="p-2 rounded-lg bg-primary-soft text-primary">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="font-display font-extrabold text-2xl text-foreground">
                {metrics.totalUsers}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Registered profiles across tenants
              </p>
            </Card>

            <Card className="border border-border bg-surface shadow-subtle p-5">
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-xs font-medium">Tenders Processed</span>
                <div className="p-2 rounded-lg bg-primary-soft text-primary">
                  <FileText className="h-4 w-4" />
                </div>
              </div>
              <div className="font-display font-extrabold text-2xl text-foreground">
                {metrics.totalOpportunities}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {metrics.totalSubmissions} proposals submitted
              </p>
            </Card>
          </div>

          {/* Plan Distribution & Commercial Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border border-border bg-surface shadow-subtle">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Recent Companies</CardTitle>
                  <CardDescription className="text-xs">
                    Latest onboarding organizations
                  </CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <Link to="/admin/companies">
                    View all <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/80 text-muted-foreground">
                        <th className="pb-2 font-medium">Workspace</th>
                        <th className="pb-2 font-medium">Tier</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {metrics.recentWorkspaces.map((ws) => (
                        <tr key={ws.id} className="hover:bg-surface-muted/50">
                          <td className="py-2.5 font-semibold text-foreground">{ws.name}</td>
                          <td className="py-2.5 capitalize font-mono text-[11px]">
                            {ws.plan}
                          </td>
                          <td className="py-2.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-mono ${
                                ws.subscription_status === "active"
                                  ? "border-bid text-bid"
                                  : "border-muted-foreground/40 text-muted-foreground"
                              }`}
                            >
                              {ws.subscription_status}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {new Date(ws.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-surface shadow-subtle">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Plan Distribution</CardTitle>
                <CardDescription className="text-xs">
                  Active tenants by tier
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                {Object.entries(metrics.planDistribution).map(([tier, count]) => {
                  const pct =
                    metrics.totalWorkspaces > 0
                      ? Math.round((count / metrics.totalWorkspaces) * 100)
                      : 0;

                  return (
                    <div key={tier} className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold capitalize text-foreground">{tier}</span>
                        <span className="font-mono text-muted-foreground">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
