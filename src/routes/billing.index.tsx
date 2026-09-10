import React, { useState, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles,
  Layers,
  History,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  PLAN_CONFIGS,
  PURCHASABLE_PLANS,
  SUPPORTED_CURRENCIES,
  formatBillingAmount,
  type PlanTier,
  type BillingCurrency,
  type WorkspaceBillingContext,
} from "@/lib/billing/plans";
import {
  getWorkspaceBillingFn,
  initiateCheckoutFn,
  getBillingHistoryFn,
} from "@/lib/billing/billing.functions";
import type { Database } from "@/integrations/supabase/types";

type BillingTransactionRow = Database["public"]["Tables"]["billing_transactions"]["Row"];

export const Route = createFileRoute("/billing/")({
  component: BillingPage,
});

function BillingPage() {
  const { workspace, companyProfile, role } = useWorkspace();
  const navigate = useNavigate();

  // Selected currency (defaults to MWK if Malawi, otherwise USD)
  const defaultCurrency: BillingCurrency = companyProfile?.country?.toLowerCase().includes("malawi")
    ? "MWK"
    : "USD";

  const [currency, setCurrency] = useState<BillingCurrency>(defaultCurrency);
  const [billingContext, setBillingContext] = useState<WorkspaceBillingContext | null>(null);
  const [transactions, setTransactions] = useState<BillingTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<PlanTier | null>(null);

  useEffect(() => {
    if (companyProfile?.country?.toLowerCase().includes("malawi")) {
      setCurrency("MWK");
    }
  }, [companyProfile?.country]);

  const loadData = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const [billing, history] = await Promise.all([
        getWorkspaceBillingFn({ data: { workspaceId: workspace.id } }),
        getBillingHistoryFn({ data: { workspaceId: workspace.id } }),
      ]);
      setBillingContext(billing as WorkspaceBillingContext);
      setTransactions(history as BillingTransactionRow[]);
    } catch (err) {
      console.error("[Billing] Failed to load billing details:", err);
      toast.error("Could not load billing details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSelectPlan(plan: "starter" | "growth" | "pro") {
    if (!workspace) return;
    setProcessingPlan(plan);
    try {
      toast.info(`Preparing secure PayChangu checkout for ${PLAN_CONFIGS[plan].name}...`);
      const res = await initiateCheckoutFn({
        data: {
          workspaceId: workspace.id,
          plan,
          currency,
        },
      });

      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        throw new Error("No checkout URL returned.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initiate payment";
      console.error("[Billing] Checkout error:", err);
      toast.error(msg);
      setProcessingPlan(null);
    }
  }

  const currentPlan = (workspace?.plan as PlanTier) || "trial";
  const currentPlanConfig = PLAN_CONFIGS[currentPlan] || PLAN_CONFIGS.trial;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <CreditCard className="h-6 w-6 text-accent" />
              Subscription & Entitlements
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your subscription plan and tender analysis allowance.
            </p>
          </div>

          {/* Currency Switcher */}
          <div className="flex items-center gap-2 bg-secondary/80 p-1 rounded-xl border border-border/60 self-start md:self-auto">
            <span className="text-xs font-mono text-muted-foreground px-2">Currency:</span>
            {SUPPORTED_CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  currency === c
                    ? "bg-card text-foreground shadow-sm font-bold border border-border/40"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "MWK" ? "MWK (Malawi)" : "USD (International)"}
              </button>
            ))}
          </div>
        </div>

        {/* Current Active Plan Overview */}
        <Card className="border border-border/80 shadow-panel bg-card">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <span>Current Plan:</span>
                  <span className="text-accent font-bold">{currentPlanConfig.name}</span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {currentPlanConfig.description}
                </CardDescription>
              </div>

              <Badge
                variant="outline"
                className={`font-mono text-xs uppercase px-2.5 py-1 ${
                  workspace?.subscription_status === "active"
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold"
                }`}
              >
                Status: {workspace?.subscription_status || "trialing"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl border border-border/60 bg-surface/40 space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  {currentPlan === "trial" ? "Trial Allowance" : "Subscription Allowance"}
                </span>
                <div className="font-display text-xl font-bold text-foreground">
                  {currentPlanConfig.analysisAllowance === -1
                    ? "Unlimited"
                    : `${currentPlanConfig.analysisAllowance} ${currentPlan === "trial" ? "analyses total" : "analyses/period"}`}
                </div>
                <p className="text-xs text-muted-foreground">
                  {currentPlan === "trial"
                    ? "Evaluation quota"
                    : "Server-authoritative period allowance"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-border/60 bg-surface/40 space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Utilized This Period
                </span>
                <div className="font-display text-xl font-bold text-foreground">
                  {billingContext?.analysesUsed ?? 0}
                  {currentPlanConfig.analysisAllowance !== -1 && (
                    <span className="text-xs font-mono text-muted-foreground font-normal ml-1">
                      / {currentPlanConfig.analysisAllowance}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {billingContext?.analysesAllowance === -1
                    ? "Unmetered volume"
                    : `${billingContext?.remainingAnalyses ?? 0} analyses remaining`}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-border/60 bg-surface/40 space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  {currentPlan === "trial" ? "Trial Expiration" : "Period Renewal"}
                </span>
                <div className="font-display text-xl font-bold text-foreground">
                  {billingContext?.countdownText ||
                    (currentPlan === "trial"
                      ? workspace?.trial_ends_at
                        ? new Date(workspace.trial_ends_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "14-day evaluation"
                      : billingContext?.renewalDate || billingContext?.currentPeriodEnd
                        ? new Date(
                            (billingContext.renewalDate || billingContext.currentPeriodEnd)!,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Active Period")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {billingContext?.isTrialExpired
                    ? "Trial period ended. Upgrade required."
                    : currentPlan === "trial"
                      ? "14-day commercial evaluation"
                      : `Cycle ends ${
                          billingContext?.currentPeriodEnd
                            ? new Date(billingContext.currentPeriodEnd).toLocaleDateString()
                            : "on renewal"
                        }`}
                </p>
              </div>
            </div>

            {/* Trial Expiration Warning if active on trial */}
            {currentPlan === "trial" && (
              <div
                className={`mt-4 p-3.5 rounded-xl border flex items-start gap-3 ${
                  billingContext?.isTrialExpired
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
                }`}
              >
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">
                    {billingContext?.isTrialExpired
                      ? "Your 14-day evaluation has expired."
                      : "You are currently on a 14-day evaluation pilot."}
                  </p>
                  <p className="text-muted-foreground">
                    GetBidRadar does not offer a permanent free plan. Select a commercial plan below
                    to unlock regular monthly capacity and keep your team active.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Selection Grid */}
        <div className="space-y-4">
          <div className="text-center md:text-left space-y-1">
            <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
              Commercial Qualification Tiers
            </h2>
            <p className="text-xs text-muted-foreground">
              Instant activation via PayChangu secure card, mobile money, and bank transfer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PURCHASABLE_PLANS.map((tier) => {
              const plan = PLAN_CONFIGS[tier];
              const isCurrent = currentPlan === tier && workspace?.subscription_status === "active";
              const isProcessing = processingPlan === tier;
              const priceFormatted = formatBillingAmount(plan.monthlyPrice[currency], currency);

              return (
                <Card
                  key={tier}
                  className={`border rounded-2xl flex flex-col justify-between transition-all duration-200 ${
                    plan.highlighted
                      ? "border-accent ring-2 ring-accent/20 shadow-lg bg-card"
                      : "border-border/80 shadow-panel bg-card hover:border-border"
                  }`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-lg font-bold text-foreground">
                        {plan.name}
                      </span>
                      {plan.badge && (
                        <Badge className="bg-accent/15 text-accent border border-accent/30 text-[10px] uppercase font-mono font-bold">
                          {plan.badge}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs min-h-[32px] mt-1">
                      {plan.description}
                    </CardDescription>

                    <div className="pt-4 border-t border-border/40">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-3xl font-extrabold text-foreground tracking-tight">
                          {priceFormatted}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">/ month</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono mt-1">
                        {plan.analysisAllowance === -1
                          ? "Unlimited qualification pipeline"
                          : `${plan.analysisAllowance} tender qualifications per month`}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                        Included Capabilities:
                      </span>
                      <ul className="space-y-2 text-xs">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-foreground/90">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-4 border-t border-border/40">
                    <Button
                      type="button"
                      disabled={isCurrent || isProcessing}
                      onClick={() => handleSelectPlan(tier as "starter" | "growth" | "pro")}
                      className={`w-full font-semibold rounded-xl text-xs py-5 ${
                        isCurrent
                          ? "bg-secondary text-muted-foreground cursor-default"
                          : plan.highlighted
                            ? "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Connecting Gateway...
                        </>
                      ) : isCurrent ? (
                        "Active Plan"
                      ) : (
                        `Upgrade to ${plan.name} →`
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Billing & Payment History */}
        <div className="space-y-4 pt-6 border-t border-border/60">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-accent" />
            <h3 className="font-display text-lg font-bold text-foreground">
              Billing Transaction History
            </h3>
          </div>

          <Card className="border border-border/80 shadow-panel bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/60 text-muted-foreground font-mono uppercase text-[10px] border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Plan Tier</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground font-sans text-xs"
                      >
                        No payment transactions recorded for this workspace yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 font-sans font-semibold text-foreground uppercase">
                          {tx.plan}
                        </td>
                        <td className="py-3 px-4 text-foreground font-bold">
                          {formatBillingAmount(Number(tx.amount), tx.currency as BillingCurrency)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-[11px]">{tx.tx_ref}</td>
                        <td className="py-3 px-4 text-right">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-mono ${
                              tx.status === "successful"
                                ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold"
                                : tx.status === "pending"
                                  ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                                  : "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10"
                            }`}
                          >
                            {tx.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
