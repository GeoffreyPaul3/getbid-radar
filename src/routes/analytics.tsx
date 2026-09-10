import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Target,
  Clock,
  AlertTriangle,
  Trophy,
  FileText,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useWorkspace } from "@/lib/workspace-context";
import { getWorkspaceAnalyticsFn } from "@/lib/analytics/analytics.functions";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#e0e7ff"];
const WIN_COLOR = "#22c55e";
const LOSS_COLOR = "#ef4444";

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex items-start gap-4 hover:border-primary/30 transition-colors">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${accent || "bg-primary-soft text-primary"}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold font-display text-foreground tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/70 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function AnalyticsPage() {
  const { isReady, AuthLoadingFallback, workspace } = useRequireAuth();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics", workspace?.id],
    queryFn: () =>
      workspace?.id ? getWorkspaceAnalyticsFn({ data: { workspaceId: workspace.id } }) : null,
    enabled: isReady && !!workspace?.id,
    staleTime: 60_000,
  });

  if (!isReady) return AuthLoadingFallback;

  const opportunityPipelineData = analytics
    ? [
        { name: "BID", value: analytics.bidDecisions, fill: "#6366f1" },
        { name: "REVIEW", value: analytics.reviewDecisions, fill: "#f59e0b" },
        { name: "NO-BID", value: analytics.noBidDecisions, fill: "#ef4444" },
        {
          name: "Pending",
          value: analytics.totalOpportunities - analytics.analysisComplete,
          fill: "#94a3b8",
        },
      ].filter((d) => d.value > 0)
    : [];

  const bidOutcomesData = analytics
    ? [
        { name: "Won", value: analytics.wonBids, fill: WIN_COLOR },
        { name: "Lost", value: analytics.lostBids, fill: LOSS_COLOR },
        { name: "Cancelled", value: analytics.cancelledBids, fill: "#94a3b8" },
        { name: "Active", value: analytics.activeBids, fill: "#6366f1" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <AppShell>
      <div className="min-h-screen bg-canvas">
        {/* Page Header */}
        <div className="border-b border-border bg-surface px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display text-foreground">
                Performance Analytics
              </h1>
              <p className="text-xs text-muted-foreground">
                Workspace bid intelligence and pipeline metrics
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8 max-w-7xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading analytics…</span>
            </div>
          ) : (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Total Opportunities"
                  value={analytics?.totalOpportunities ?? 0}
                  icon={FileText}
                />
                <StatCard
                  label="Win Rate"
                  value={`${analytics?.winRate ?? 0}%`}
                  icon={Trophy}
                  accent="bg-green-100 text-green-700"
                  sub={`${analytics?.wonBids ?? 0} won of ${(analytics?.wonBids ?? 0) + (analytics?.lostBids ?? 0)} decided`}
                />
                <StatCard
                  label="Active Bids"
                  value={analytics?.activeBids ?? 0}
                  icon={Target}
                  accent="bg-indigo-50 text-indigo-600"
                />
                <StatCard
                  label="Overdue Tasks"
                  value={analytics?.overdueTaskCount ?? 0}
                  icon={AlertTriangle}
                  accent={
                    (analytics?.overdueTaskCount ?? 0) > 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-surface-muted text-muted-foreground"
                  }
                />
              </div>

              {/* Charts row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Opportunity Pipeline */}
                <div className="bg-surface border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4">
                    Opportunity Pipeline
                  </h2>
                  {opportunityPipelineData.length === 0 ? (
                    <EmptyState message="Analyze tenders to see pipeline data" />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={opportunityPipelineData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={85}
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {opportunityPipelineData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend iconType="circle" iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Bid Outcomes */}
                <div className="bg-surface border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Bid Outcomes</h2>
                  {bidOutcomesData.length === 0 ? (
                    <EmptyState message="Record bid outcomes to see win/loss data" />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={bidOutcomesData} barSize={36}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {bidOutcomesData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* 12-month Trend */}
              <div className="bg-surface border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">
                  Opportunity Intake — Last 12 Months
                </h2>
                {!analytics || analytics.opportunityTrend.every((t) => t.count === 0) ? (
                  <EmptyState message="No opportunity data in the last 12 months" />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={analytics.opportunityTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: string) => v.slice(5)}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#6366f1" }}
                        name="Opportunities"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Win Rate by Category */}
              <div className="bg-surface border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Win Rate by Category</h2>
                {!analytics || analytics.winRateByCategory.length === 0 ? (
                  <EmptyState message="Record bid outcomes across categories to see win rate breakdown" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={analytics.winRateByCategory} layout="vertical" barSize={16}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                      <YAxis
                        type="category"
                        dataKey="category"
                        tick={{ fontSize: 10 }}
                        width={120}
                      />
                      <Tooltip
                        formatter={(v: number) => [`${v}%`, "Win Rate"]}
                        contentStyle={{
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="rate" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Operational metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="Avg. Qualification Score"
                  value={
                    analytics?.averageQualificationScore != null
                      ? `${analytics.averageQualificationScore}`
                      : "—"
                  }
                  icon={TrendingUp}
                  sub="Across all analyzed tenders"
                />
                <StatCard
                  label="Avg. Preparation Days"
                  value={
                    analytics?.averagePreparationDays != null
                      ? `${analytics.averagePreparationDays}d`
                      : "—"
                  }
                  icon={Clock}
                  sub="Intake to submission"
                />
                <StatCard
                  label="Open Compliance Issues"
                  value={analytics?.openComplianceIssues ?? 0}
                  icon={AlertTriangle}
                  accent={
                    (analytics?.openComplianceIssues ?? 0) > 0
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }
                  sub="Critical & high severity"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
