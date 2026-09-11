import React, { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  TrendingUp,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { getAdminRevenueFn, type AdminTransactionRecord } from "@/lib/admin/admin.functions";
import { PLAN_CONFIGS, isPlanTier } from "@/lib/billing/plans";

export const Route = createFileRoute("/admin/revenue")({
  component: AdminRevenuePage,
});

function statusBadge(status: string) {
  switch (status) {
    case "active":
    case "completed":
    case "successful":
      return (
        <Badge className="text-[10px] font-mono bg-bid-soft text-bid border-bid/30 border">
          <CheckCircle2 className="h-3 w-3 mr-1" />{status}
        </Badge>
      );
    case "pending":
    case "initiated":
      return (
        <Badge variant="outline" className="text-[10px] font-mono text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
          <Clock className="h-3 w-3 mr-1" />{status}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] font-mono text-destructive border-destructive/30">
          <XCircle className="h-3 w-3 mr-1" />{status}
        </Badge>
      );
  }
}

function AdminRevenuePage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<AdminTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchRevenue = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminRevenueFn({ data: { adminUserId: user.id } });
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load revenue data.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  const filtered = transactions.filter((t) => {
    const q = search.toLowerCase();
    return (
      !q ||
      t.workspace_name?.toLowerCase().includes(q) ||
      t.plan?.toLowerCase().includes(q) ||
      t.tx_ref?.toLowerCase().includes(q) ||
      t.status?.toLowerCase().includes(q)
    );
  });

  const totalRevenue_USD = transactions
    .filter((t) => ["active", "completed", "successful"].includes(t.status))
    .reduce((sum, t) => {
      if (t.currency === "USD") return sum + t.amount;
      // Rough MWK→USD conversion at ~1730 for display only
      if (t.currency === "MWK") return sum + t.amount / 1730;
      return sum;
    }, 0);

  const planBreakdown: Record<string, { count: number; revenue: number }> = {};
  for (const t of transactions) {
    if (["active", "completed", "successful"].includes(t.status)) {
      const entry = (planBreakdown[t.plan] ??= { count: 0, revenue: 0 });
      entry.count++;
      const usdAmount = t.currency === "USD" ? t.amount : t.amount / 1730;
      entry.revenue += usdAmount;
    }
  }

  return (
    <AdminShell
      title="Revenue & Transactions"
      description="All billing transactions, payment statuses, and commercial revenue summary."
    >
      <div className="space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-border bg-surface shadow-subtle p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Total Revenue (USD)</span>
              <div className="p-2 rounded-lg bg-primary-soft text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="font-display font-extrabold text-2xl text-foreground">
              ${Math.round(totalRevenue_USD).toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">From confirmed transactions</p>
          </Card>
          <Card className="border border-border bg-surface shadow-subtle p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Total Transactions</span>
              <div className="p-2 rounded-lg bg-primary-soft text-primary">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="font-display font-extrabold text-2xl text-foreground">
              {transactions.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">All time payment records</p>
          </Card>
          <Card className="border border-border bg-surface shadow-subtle p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Successful Payments</span>
              <div className="p-2 rounded-lg bg-primary-soft text-primary">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="font-display font-extrabold text-2xl text-bid">
              {transactions.filter((t) => ["active", "completed", "successful"].includes(t.status)).length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Confirmed activations</p>
          </Card>
        </div>

        {/* Plan Breakdown */}
        {Object.keys(planBreakdown).length > 0 && (
          <Card className="border border-border bg-surface shadow-subtle">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Revenue by Plan</CardTitle>
              <CardDescription className="text-xs">Confirmed payments grouped by subscription tier.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(planBreakdown).map(([plan, data]) => (
                  <div key={plan} className="p-4 rounded-xl border border-border/60 bg-surface/40 text-center">
                    <p className="text-[10px] uppercase font-mono text-muted-foreground">{plan}</p>
                    <p className="font-display font-bold text-lg text-foreground mt-1">{data.count}</p>
                    <p className="text-xs text-bid font-mono">${Math.round(data.revenue).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transactions Table */}
        <Card className="border border-border bg-surface shadow-subtle">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold">All Transactions</CardTitle>
              <CardDescription className="text-xs">Complete billing history across all workspaces.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="admin-revenue-search"
                  placeholder="Search workspace, plan, ref..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-60"
                />
              </div>
              <Button variant="outline" size="sm" onClick={fetchRevenue} disabled={loading} className="text-xs h-8">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /><span className="text-xs">Loading transactions...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-xs text-destructive flex items-center justify-between">
                <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>
                <Button size="sm" variant="outline" onClick={fetchRevenue} className="text-xs">Retry</Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                {search ? `No transactions match "${search}".` : "No billing transactions recorded yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="pb-3 font-medium">Workspace</th>
                      <th className="pb-3 font-medium">Plan</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Reference</th>
                      <th className="pb-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filtered.map((t) => (
                      <tr key={t.id} className="hover:bg-surface-muted/40 transition-colors">
                        <td className="py-3 pr-4 font-semibold text-foreground">{t.workspace_name || "—"}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="font-mono text-[10px] capitalize">{t.plan}</Badge>
                        </td>
                        <td className="py-3 pr-4 font-mono text-foreground font-medium">
                          {t.currency} {t.amount.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4">{statusBadge(t.status)}</td>
                        <td className="py-3 pr-4 font-mono text-[10px] text-muted-foreground max-w-[140px] truncate" title={t.tx_ref}>
                          {t.tx_ref || "—"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
