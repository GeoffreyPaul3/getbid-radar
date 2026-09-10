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
  Trophy,
  XCircle,
  AlertCircle,
  Ban,
  TrendingUp,
  BrainCircuit,
  Loader2,
  DollarSign,
  Building2,
  CheckCircle2,
  PieChart,
} from "lucide-react";
import { toast } from "sonner";
import {
  recordBidOutcomeFn,
  getBidOutcomeFn,
  getLearningInsightsFn,
} from "@/lib/outcomes/outcomes.functions";
import type { BidOutcomeRecord, LearningInsights } from "@/lib/outcomes/outcomes.types";

interface OutcomesLearningTabProps {
  opportunityId: string;
  workspaceId: string;
  contractCurrency?: string | null | undefined;
  contractValue?: number | null | undefined;
}

export function OutcomesLearningTab({
  opportunityId,
  workspaceId,
  contractCurrency,
  contractValue,
}: OutcomesLearningTabProps) {
  const [outcome, setOutcome] = useState<BidOutcomeRecord | null>(null);
  const [insights, setInsights] = useState<LearningInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  // Form State
  const [status, setStatus] = useState<"won" | "lost" | "cancelled" | "disqualified">("won");
  const [winningCompany, setWinningCompany] = useState("");
  const [winningPrice, setWinningPrice] = useState("");
  const [ourBidPrice, setOurBidPrice] = useState(contractValue ? String(contractValue) : "");
  const [evaluationScore, setEvaluationScore] = useState("");
  const [lossReason, setLossReason] = useState("Pricing / Financial Evaluation");
  const [disqualificationReason, setDisqualificationReason] = useState("");
  const [buyerFeedback, setBuyerFeedback] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [out, ins] = await Promise.all([
        getBidOutcomeFn({ data: { opportunityId, workspaceId } }),
        getLearningInsightsFn({ data: { workspaceId } }),
      ]);
      setOutcome(out);
      setInsights(ins);

      if (out) {
        setStatus(out.result as "won" | "lost" | "cancelled" | "disqualified");
        setWinningCompany(out.winning_company || "");
        setWinningPrice(out.winning_price ? String(out.winning_price) : "");
        setOurBidPrice(out.our_price ? String(out.our_price) : "");
        setEvaluationScore(out.evaluation_score ? String(out.evaluation_score) : "");
        setLossReason(out.loss_reason || "Pricing / Financial Evaluation");
        setDisqualificationReason(out.disqualification_reason || "");
        setBuyerFeedback(out.feedback || "");
        setLessonsLearned(out.lessons_learned || "");
      }
    } catch (err) {
      console.error("[Outcomes] Load error:", err);
      toast.error("Failed to load bid outcome");
    } finally {
      setLoading(false);
    }
  }, [opportunityId, workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await recordBidOutcomeFn({
        data: {
          opportunityId,
          workspaceId,
          status,
          ...(winningCompany.trim() ? { winning_company: winningCompany.trim() } : {}),
          ...(winningPrice ? { winning_price: Number(winningPrice) } : {}),
          ...(ourBidPrice ? { our_bid_price: Number(ourBidPrice) } : {}),
          ...(evaluationScore ? { evaluation_score: Number(evaluationScore) } : {}),
          ...(status === "lost" && lossReason.trim() ? { loss_reason: lossReason.trim() } : {}),
          ...(status === "disqualified" && disqualificationReason.trim()
            ? { disqualification_reason: disqualificationReason.trim() }
            : {}),
          ...(buyerFeedback.trim() ? { buyer_feedback: buyerFeedback.trim() } : {}),
          ...(lessonsLearned.trim() ? { lessons_learned: lessonsLearned.trim() } : {}),
        },
      });

      toast.success("Tender outcome and debrief notes saved!");
      setShowEditForm(false);
      await loadData();
    } catch (err) {
      toast.error("Failed to save outcome", { description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  const currency = contractCurrency || "MWK";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="border-b border-border/60 pb-4">
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          Outcomes & Post-Bid Learning Intelligence
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Record win/loss results, track competitor pricing, and build institutional knowledge for
          future bids.
        </p>
      </div>

      {/* ── Recorded Outcome Banner ── */}
      {outcome && !showEditForm ? (
        <Card
          className={`border p-6 space-y-4 ${
            outcome.result === "won"
              ? "border-emerald-500/40 bg-emerald-500/10"
              : outcome.result === "lost"
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-destructive/40 bg-destructive/10"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  outcome.result === "won"
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : outcome.result === "lost"
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "bg-destructive/20 text-destructive"
                }`}
              >
                {outcome.result === "won" ? (
                  <Trophy className="h-6 w-6" />
                ) : outcome.result === "lost" ? (
                  <XCircle className="h-6 w-6" />
                ) : (
                  <Ban className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground capitalize">
                  Bid Outcome: {outcome.result}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Recorded on {new Date(outcome.recorded_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                className={`font-mono text-xs uppercase px-3 py-1 ${
                  outcome.result === "won"
                    ? "bg-emerald-600 text-white"
                    : outcome.result === "lost"
                      ? "bg-amber-600 text-white"
                      : "bg-destructive text-white"
                }`}
              >
                {outcome.result.toUpperCase()}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEditForm(true)}
                className="text-xs"
              >
                Edit Outcome
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="p-3 rounded-lg bg-background/60 border border-border/40 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Our Submitted Price
              </span>
              <p className="font-semibold text-xs font-mono text-foreground">
                {outcome.our_price != null
                  ? `${currency} ${Number(outcome.our_price).toLocaleString()}`
                  : "Not recorded"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-background/60 border border-border/40 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Winning Provider
              </span>
              <p className="font-semibold text-xs text-foreground">
                {outcome.winning_company || "Not disclosed"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-background/60 border border-border/40 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Winning Price
              </span>
              <p className="font-semibold text-xs font-mono text-foreground">
                {outcome.winning_price != null
                  ? `${currency} ${Number(outcome.winning_price).toLocaleString()}`
                  : "Not disclosed"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-background/60 border border-border/40 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Evaluation Score
              </span>
              <p className="font-semibold text-xs font-mono text-foreground">
                {outcome.evaluation_score != null ? `${outcome.evaluation_score}/100` : "None"}
              </p>
            </div>
          </div>

          {outcome.loss_reason && (
            <div className="p-3 rounded-lg bg-background/60 border border-border/40 text-xs text-muted-foreground">
              <span className="font-semibold text-amber-600 dark:text-amber-400 mr-2 font-mono uppercase text-[10px]">
                Loss Reason:
              </span>
              {outcome.loss_reason}
            </div>
          )}

          {outcome.feedback && (
            <div className="p-3 rounded-lg bg-background/60 border border-border/40 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground mr-2 font-mono uppercase text-[10px]">
                Buyer Feedback / Debrief:
              </span>
              {outcome.feedback}
            </div>
          )}

          {outcome.lessons_learned && (
            <div className="p-3 rounded-lg bg-background/60 border border-border/40 text-xs text-muted-foreground">
              <span className="font-semibold text-accent mr-2 font-mono uppercase text-[10px]">
                Internal Lessons Learned:
              </span>
              {outcome.lessons_learned}
            </div>
          )}
        </Card>
      ) : (
        /* ── Record Outcome Form ── */
        <Card className="border border-border/80 shadow-panel bg-card">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-accent" />
                  {outcome ? "Edit Bid Outcome & Debrief" : "Record Bid Outcome"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Capture official procurement award decisions and competitor intelligence.
                </CardDescription>
              </div>
              {outcome && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowEditForm(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Outcome Result *</Label>
                  <Select
                    value={status}
                    onValueChange={(v) =>
                      setStatus(v as "won" | "lost" | "cancelled" | "disqualified")
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="won">Won — Contract Awarded</SelectItem>
                      <SelectItem value="lost">Lost — Competitor Awarded</SelectItem>
                      <SelectItem value="cancelled">Cancelled — Tender Annulled</SelectItem>
                      <SelectItem value="disqualified">Disqualified — Non-compliant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Our Submitted Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={ourBidPrice}
                    onChange={(e) => setOurBidPrice(e.target.value)}
                    placeholder="e.g. 35000000"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {status === "lost" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Winning Company / Awardee</Label>
                    <Input
                      value={winningCompany}
                      onChange={(e) => setWinningCompany(e.target.value)}
                      placeholder="e.g. Apex Global Solutions Ltd"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Winning Bid Price ({currency})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={winningPrice}
                      onChange={(e) => setWinningPrice(e.target.value)}
                      placeholder="e.g. 31500000"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Primary Loss Reason</Label>
                    <Select value={lossReason} onValueChange={setLossReason}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pricing / Financial Evaluation">
                          Pricing / Financial Evaluation
                        </SelectItem>
                        <SelectItem value="Technical Score Lower">Technical Score Lower</SelectItem>
                        <SelectItem value="Incumbent Competitor Advantage">
                          Incumbent Competitor Advantage
                        </SelectItem>
                        <SelectItem value="Missing Compliance Attachment">
                          Missing Compliance Attachment
                        </SelectItem>
                        <SelectItem value="Delivery Timeline Infeasible">
                          Delivery Timeline Infeasible
                        </SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {status === "disqualified" && (
                <div className="space-y-1.5 p-3.5 rounded-xl border border-destructive/20 bg-destructive/5">
                  <Label className="text-xs">Disqualification Reason *</Label>
                  <Input
                    required
                    value={disqualificationReason}
                    onChange={(e) => setDisqualificationReason(e.target.value)}
                    placeholder="e.g. Bid bond validity period expired 3 days short of RFP requirement"
                    className="h-9 text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Evaluation Score (0–100)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={evaluationScore}
                    onChange={(e) => setEvaluationScore(e.target.value)}
                    placeholder="e.g. 88.5"
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Official Buyer Feedback / Debrief</Label>
                  <Input
                    value={buyerFeedback}
                    onChange={(e) => setBuyerFeedback(e.target.value)}
                    placeholder="e.g. Strong technical approach, recommended higher local staffing"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Internal Lessons Learned & Takeaways</Label>
                <Textarea
                  rows={3}
                  value={lessonsLearned}
                  onChange={(e) => setLessonsLearned(e.target.value)}
                  placeholder="e.g. For future health sector bids, include at least 2 public hospital reference contacts..."
                  className="text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-xs gap-1.5"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Save Outcome & Learning Record
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Workspace Learning Insights ── */}
      {insights && (
        <Card className="border border-border/80 shadow-panel bg-card">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-accent" />
              Workspace Win/Loss Intelligence
            </CardTitle>
            <CardDescription className="text-xs">
              Aggregate patterns derived across all past bids in this workspace.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {!insights.hasEnoughData ? (
              <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground space-y-1 bg-surface/20">
                <p className="font-semibold text-foreground">Initial Intelligence Threshold</p>
                <p>{insights.minimumDataMessage}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-border/60 bg-surface/30 space-y-1 text-xs">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">
                      Total Tracked Bids
                    </span>
                    <p className="font-bold text-lg text-foreground">{insights.totalBids}</p>
                  </div>

                  <div className="p-3 rounded-lg border border-border/60 bg-surface/30 space-y-1 text-xs">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">
                      Win Rate
                    </span>
                    <p className="font-bold text-lg text-emerald-500">{insights.winRate}%</p>
                  </div>

                  <div className="p-3 rounded-lg border border-border/60 bg-surface/30 space-y-1 text-xs">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">
                      Contracts Won
                    </span>
                    <p className="font-bold text-lg text-foreground">
                      {insights.winCount} / {insights.totalBids}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border/60 bg-surface/30 space-y-1 text-xs">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">
                      Avg. Won Value
                    </span>
                    <p className="font-bold text-lg font-mono text-foreground">
                      {insights.averageBidValue != null
                        ? `${currency} ${insights.averageBidValue.toLocaleString()}`
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {insights.commonLossReasons.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-semibold font-mono uppercase text-muted-foreground">
                      Frequent Loss Reasons:
                    </span>
                    <div className="space-y-1.5">
                      {insights.commonLossReasons.map((lr) => (
                        <div
                          key={lr.reason}
                          className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-border/40 bg-surface/20"
                        >
                          <span className="text-foreground font-medium">{lr.reason}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {lr.count} bid{lr.count !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
