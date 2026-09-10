import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck,
  ShieldAlert,
  Loader2,
  Calendar,
  Building2,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import {
  checkSubmissionReadinessFn,
  recordSubmissionFn,
  getSubmissionFn,
} from "@/lib/submissions/submissions.functions";
import type { SubmissionReadiness, SubmissionRecord } from "@/lib/submissions/submissions.types";

interface SubmissionTrackingTabProps {
  opportunityId: string;
  workspaceId: string;
  contractCurrency?: string | null | undefined;
  contractValue?: number | null | undefined;
}

export function SubmissionTrackingTab({
  opportunityId,
  workspaceId,
  contractCurrency,
  contractValue,
}: SubmissionTrackingTabProps) {
  const [readiness, setReadiness] = useState<SubmissionReadiness | null>(null);
  const [submission, setSubmission] = useState<SubmissionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submission Form State
  const [submissionMethod, setSubmissionMethod] = useState("E-Procurement Portal");
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [bidPrice, setBidPrice] = useState<string>(
    contractValue ? String(contractValue) : "",
  );
  const [currency, setCurrency] = useState(contractCurrency || "USD");
  const [submittedAt, setSubmittedAt] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ready, sub] = await Promise.all([
        checkSubmissionReadinessFn({ data: { opportunityId, workspaceId } }),
        getSubmissionFn({ data: { opportunityId, workspaceId } }),
      ]);
      setReadiness(ready);
      setSubmission(sub);
    } catch (err) {
      console.error("[Submissions] Load error:", err);
      toast.error("Failed to load submission status");
    } finally {
      setLoading(false);
    }
  }, [opportunityId, workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionMethod) {
      toast.error("Please specify a submission method");
      return;
    }

    if (readiness?.blockers && readiness.blockers.length > 0) {
      const confirm = window.confirm(
        `Warning: There are ${readiness.blockers.length} active blockers on this bid. Do you still want to record this submission?`,
      );
      if (!confirm) return;
    }

    setIsSubmitting(true);
    try {
      await recordSubmissionFn({
        data: {
          opportunityId,
          workspaceId,
          submission_method: submissionMethod,
          ...(confirmationNumber.trim() ? { confirmation_number: confirmationNumber.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          submitted_at: submittedAt ? new Date(submittedAt).toISOString() : new Date().toISOString(),
          ...(bidPrice ? { bid_price: Number(bidPrice) } : {}),
          ...(currency ? { currency } : {}),
        },
      });

      toast.success("Tender submission successfully recorded!");
      await loadData();
    } catch (err) {
      toast.error("Failed to record submission", { description: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="border-b border-border/60 pb-4">
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Send className="h-5 w-5 text-accent" />
          Submission Tracking & Readiness
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Verify submission prerequisites, resolve blocking criteria, and log confirmed tender
          delivery.
        </p>
      </div>

      {/* ── Already Submitted Banner ── */}
      {submission && (
        <Card className="border border-emerald-500/40 bg-emerald-500/10 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  Bid Officially Submitted
                </h3>
                <p className="text-xs text-muted-foreground">
                  Submission confirmed and logged to workspace audit history.
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-600 text-white font-mono text-xs uppercase px-3 py-1">
              STATUS: SUBMITTED
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="p-3 rounded-lg bg-background/60 border border-border/40 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Submission Method
              </span>
              <p className="font-semibold text-xs text-foreground">
                {submission.submission_method || "Direct submission"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-background/60 border border-border/40 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Confirmation / Reference #
              </span>
              <p className="font-semibold text-xs font-mono text-foreground">
                {submission.reference_number || "None recorded"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-background/60 border border-border/40 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Date & Time Submitted
              </span>
              <p className="font-semibold text-xs text-foreground">
                {submission.submitted_at
                  ? new Date(submission.submitted_at).toLocaleString()
                  : "Recorded"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-background/60 border border-border/40 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Final Submitted Price
              </span>
              <p className="font-semibold text-xs font-mono text-foreground">
                {submission.bid_price != null
                  ? `${submission.currency || "USD"} ${Number(submission.bid_price).toLocaleString()}`
                  : "Not recorded"}
              </p>
            </div>
          </div>

          {submission.notes && (
            <div className="p-3 rounded-lg bg-background/60 border border-border/40 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground mr-2 font-mono uppercase text-[10px]">
                Submission Notes:
              </span>
              {submission.notes}
            </div>
          )}
        </Card>
      )}

      {/* ── Pre-Submission Readiness Checklist ── */}
      {readiness && (
        <Card className="border border-border/80 shadow-panel bg-card">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-accent" />
                  Pre-Submission Readiness Checklist
                </CardTitle>
                <CardDescription className="text-xs">
                  Automated verification before delivering final bid package.
                </CardDescription>
              </div>

              <Badge
                variant="outline"
                className={`font-mono text-xs ${
                  readiness.isReady
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold"
                    : "border-destructive/40 text-destructive bg-destructive/10 font-bold"
                }`}
              >
                {readiness.isReady ? "ALL CHECKS PASSED" : "ACTION REQUIRED"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {/* Blockers */}
            {readiness.blockers.length > 0 && (
              <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
                <div className="flex items-center gap-2 text-destructive text-xs font-bold font-mono uppercase">
                  <ShieldAlert className="h-4 w-4" />
                  Submission Blockers ({readiness.blockers.length})
                </div>
                <ul className="space-y-1 text-xs text-destructive/90 pl-5 list-disc">
                  {readiness.blockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {readiness.warnings.length > 0 && (
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold font-mono uppercase">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings ({readiness.warnings.length})
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground pl-5 list-disc">
                  {readiness.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Checklist stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-lg border border-border/60 bg-surface/30 space-y-1 text-xs">
                <span className="text-[10px] font-mono uppercase text-muted-foreground">
                  Proposal Sections
                </span>
                <p className="font-bold text-foreground">{readiness.proposalSections} drafted</p>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-surface/30 space-y-1 text-xs">
                <span className="text-[10px] font-mono uppercase text-muted-foreground">
                  Compliance Audit
                </span>
                <p className="font-bold text-foreground">
                  {readiness.criticalFindings} critical · {readiness.openFindings} open findings
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-surface/30 space-y-1 text-xs">
                <span className="text-[10px] font-mono uppercase text-muted-foreground">
                  Tender Deadline
                </span>
                <p className="font-bold text-foreground">
                  {readiness.deadlineText || "No deadline stated"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Record Submission Form ── */}
      <Card className="border border-border/80 shadow-panel bg-card">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-accent" />
            {submission ? "Update Submission Record" : "Record Confirmed Tender Submission"}
          </CardTitle>
          <CardDescription className="text-xs">
            Log official confirmation details after dispatching your proposal to the buyer.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Submission Method *</Label>
                <Select value={submissionMethod} onValueChange={setSubmissionMethod}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="E-Procurement Portal">E-Procurement Portal</SelectItem>
                    <SelectItem value="Physical Courier / Hand Delivery">
                      Physical Courier / Hand Delivery
                    </SelectItem>
                    <SelectItem value="Email / Direct Transmission">
                      Email / Direct Transmission
                    </SelectItem>
                    <SelectItem value="Client Tender Box Deposit">
                      Client Tender Box Deposit
                    </SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Confirmation / Reference Number</Label>
                <Input
                  value={confirmationNumber}
                  onChange={(e) => setConfirmationNumber(e.target.value)}
                  placeholder="e.g. PORTAL-REF-892182 or Courier Waybill #"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Date & Time Submitted</Label>
                <Input
                  type="datetime-local"
                  value={submittedAt}
                  onChange={(e) => setSubmittedAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MWK">MWK (Malawi Kwacha)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                    <SelectItem value="ZAR">ZAR (South African Rand)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Final Submitted Bid Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={bidPrice}
                  onChange={(e) => setBidPrice(e.target.value)}
                  placeholder="e.g. 45000000"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Submission Notes / Attestation</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Delivered by John Phiri at Ministry Headquarters procurement office, stamped receipt copy filed..."
                className="text-xs"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-xs gap-1.5"
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {submission ? "Update Submission Log" : "Confirm & Record Submission"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
