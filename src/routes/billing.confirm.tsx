import React, { useEffect, useState, useCallback } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowRight,
  CreditCard,
  RefreshCw,
  Clock,
} from "lucide-react";
import { verifyPaymentFn } from "@/lib/billing/billing.functions";
import {
  formatBillingAmount,
  type BillingCurrency,
  getPlanConfig,
  type PlanTier,
  type VerifyPaymentResult,
} from "@/lib/billing/plans";

const searchSchema = z.object({
  tx_ref: z.string().optional(),
});

export const Route = createFileRoute("/billing/confirm")({
  validateSearch: (search) => searchSchema.parse(search),
  component: BillingConfirmPage,
});

function BillingConfirmPage() {
  const { tx_ref: txRef } = Route.useSearch();
  const {
    workspace,
    allWorkspaces,
    isLoading: workspaceLoading,
    refetchWorkspace,
  } = useWorkspace();
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<VerifyPaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track the txRef to prevent infinite re-verification loops
  const verifiedTxRef = React.useRef<string | null>(null);
  const isExecutingRef = React.useRef(false);

  const performVerification = useCallback(
    async (force = false) => {
      if (!txRef) {
        setVerifying(false);
        return;
      }

      // Wait until workspace context finishes loading
      if (workspaceLoading) {
        return;
      }

      if (!workspace) {
        setError("Active workspace could not be loaded. Please log in again.");
        setVerifying(false);
        return;
      }

      // Skip duplicate automatic verification for the same reference
      if (!force && verifiedTxRef.current === txRef) {
        return;
      }

      if (isExecutingRef.current) {
        return;
      }

      isExecutingRef.current = true;
      verifiedTxRef.current = txRef;
      setVerifying(true);
      setError(null);

      // Find the workspace matching txRef prefix if multiple exist
      const targetWs = allWorkspaces.find((w) => txRef.includes(w.id.substring(0, 8))) || workspace;

      try {
        const res = await verifyPaymentFn({
          data: {
            workspaceId: targetWs.id,
            txRef,
          },
        });

        const verifyRes = res as VerifyPaymentResult;
        setResult(verifyRes);

        if (verifyRes.status === "successful") {
          await refetchWorkspace();
        }
      } catch (err: unknown) {
        console.error("[BillingConfirm] Verification error:", err);
        setError(err instanceof Error ? err.message : "Failed to verify transaction.");
      } finally {
        isExecutingRef.current = false;
        setVerifying(false);
      }
    },
    [txRef, workspace, allWorkspaces, workspaceLoading, refetchWorkspace],
  );

  useEffect(() => {
    performVerification();
  }, [performVerification]);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <Card className="border border-border/80 shadow-panel bg-card overflow-hidden">
          {verifying ? (
            <div className="p-12 text-center space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto" />
              <div className="space-y-1">
                <h2 className="font-display text-xl font-bold text-foreground">
                  Authorizing Payment with Gateway...
                </h2>
                <p className="text-xs text-muted-foreground font-mono">
                  Performing server-side signature and amount verification with PayChangu.
                </p>
              </div>
            </div>
          ) : error ? (
            <div>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 mb-2">
                  <XCircle className="h-6 w-6" />
                </div>
                <CardTitle className="font-display text-xl text-foreground">
                  Verification Incomplete
                </CardTitle>
                <CardDescription className="text-xs">{error}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Your workspace has not been billed or activated. If your account was charged,
                  please keep your transaction reference (
                  <span className="font-mono text-foreground font-bold">{txRef || "N/A"}</span>) and
                  contact support.
                </p>
              </CardContent>
              <CardFooter className="flex justify-center gap-3 pt-2">
                <Button asChild variant="outline" size="sm" className="text-xs">
                  <Link to="/billing">Return to Billing</Link>
                </Button>
                {txRef && (
                  <Button
                    size="sm"
                    onClick={() => performVerification(true)}
                    className="text-xs gap-1.5 bg-accent text-accent-foreground font-semibold"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry Verification
                  </Button>
                )}
              </CardFooter>
            </div>
          ) : !txRef ? (
            <div className="p-10 text-center space-y-4">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <h2 className="font-display text-lg font-bold text-foreground">
                  Missing Payment Reference
                </h2>
                <p className="text-xs text-muted-foreground">
                  No transaction reference was provided in the return URL.
                </p>
              </div>
              <Button asChild size="sm" className="text-xs bg-accent text-accent-foreground">
                <Link to="/billing">Go to Billing</Link>
              </Button>
            </div>
          ) : result?.status === "successful" ? (
            <div>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 mb-2">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <CardTitle className="font-display text-2xl font-bold text-foreground">
                  Payment Verified & Plan Active
                </CardTitle>
                <CardDescription className="text-xs">
                  Your workspace commercial subscription has been activated successfully.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                <div className="p-4 rounded-xl border border-border/60 bg-surface/50 space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-sans">Active Plan:</span>
                    <span className="font-bold text-foreground font-sans uppercase">
                      {result?.plan ? getPlanConfig(result.plan as PlanTier).name : "Active Plan"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-sans">Amount Paid:</span>
                    <span className="font-bold text-foreground">
                      {formatBillingAmount(
                        Number(result.amount),
                        (result.currency as BillingCurrency) || "MWK",
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-sans">Transaction Reference:</span>
                    <span className="text-muted-foreground text-[11px] truncate max-w-[240px]">
                      {result.txRef}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-sans">Status:</span>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px] uppercase font-bold"
                    >
                      Confirmed
                    </Badge>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  A receipt confirmation has been sent to your registered account email via Resend.
                </p>
              </CardContent>

              <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button
                  asChild
                  className="w-full sm:w-auto bg-accent text-accent-foreground font-semibold hover:bg-accent/90 shadow-sm text-xs gap-1.5"
                >
                  <Link to="/dashboard">
                    Go to Executive Dashboard <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto text-xs">
                  <Link to="/tenders/new">Qualify a New Tender</Link>
                </Button>
              </CardFooter>
            </div>
          ) : (
            <div>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 mb-2">
                  <Clock className="h-6 w-6" />
                </div>
                <CardTitle className="font-display text-xl text-foreground">
                  Payment Processing
                </CardTitle>
                <CardDescription className="text-xs">
                  {result?.message ||
                    "The payment gateway is still completing transaction authorization."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-center">
                <p className="text-xs text-muted-foreground">
                  If you just finished authorizing your mobile money or card prompt, click Check
                  Status to re-query the gateway.
                </p>
              </CardContent>
              <CardFooter className="flex justify-center gap-3 pt-2">
                <Button
                  size="sm"
                  onClick={() => performVerification(true)}
                  className="text-xs gap-1.5 bg-accent text-accent-foreground font-semibold"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Check Status Again
                </Button>
                <Button asChild variant="outline" size="sm" className="text-xs">
                  <Link to="/billing">Back to Billing</Link>
                </Button>
              </CardFooter>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
