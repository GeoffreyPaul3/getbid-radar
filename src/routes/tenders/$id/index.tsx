import React, { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Clock,
  Building2,
  ArrowRight,
  RotateCcw,
  Loader2,
  FileCheck,
  Briefcase,
  AlertOctagon,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  ListTodo,
} from "lucide-react";
import { analyzeOpportunity, getAnalysis } from "@/lib/analysis/analysis.functions";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
type OpportunityAnalysis = Database["public"]["Tables"]["opportunity_analyses"]["Row"];
type ScoreComponent = Database["public"]["Tables"]["score_components"]["Row"];

export const Route = createFileRoute("/tenders/$id/")({
  component: IntelligenceReportPage,
});

function IntelligenceReportPage() {
  const { id } = useParams({ from: "/tenders/$id/" });
  const { user } = useAuth();
  const { workspace, role } = useWorkspace();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [analysis, setAnalysis] = useState<OpportunityAnalysis | null>(null);
  const [components, setComponents] = useState<ScoreComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Human Override State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<"bid" | "review" | "no_bid">("bid");
  const [overrideReason, setOverrideReason] = useState("");
  const [isSavingDecision, setIsSavingDecision] = useState(false);

  const loadData = useCallback(async () => {
    if (!id || !workspace) return;
    try {
      // 1. Fetch Opportunity
      const { data: opp, error: oppErr } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspace.id)
        .maybeSingle();

      if (oppErr) throw oppErr;
      setOpportunity(opp);

      // 2. Fetch Latest Analysis & Score Components via getAnalysis server fn
      const res = await getAnalysis({ data: { opportunityId: id } });
      setAnalysis(res.analysis);
      setComponents(res.components);
    } catch (err) {
      console.error("[Report] Error loading opportunity data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [id, workspace]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Bounded polling while analysis is processing
  useEffect(() => {
    if (opportunity?.analysis_status !== "processing") return;
    const interval = setInterval(() => {
      loadData();
    }, 2500);
    return () => clearInterval(interval);
  }, [opportunity?.analysis_status, loadData]);

  const handleTriggerAnalysis = async (force = false) => {
    if (!id) return;
    setIsReanalyzing(true);
    const toastId = toast.loading("Executing Phase 2 qualification engine...");
    try {
      await analyzeOpportunity({
        data: {
          opportunityId: id,
          force,
        },
      });
      toast.success("Analysis complete!", { id: toastId });
      await loadData();
    } catch (err) {
      toast.error("Analysis execution error", {
        id: toastId,
        description: (err as Error).message,
      });
      await loadData();
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleSaveHumanDecision = async () => {
    if (!analysis || !opportunity || !workspace || !user) return;
    if (!overrideReason.trim()) {
      toast.error("Please provide a rationale for this human pursuit decision.");
      return;
    }

    setIsSavingDecision(true);
    try {
      // 1. Update opportunity_analyses record with human override details
      const { error: anErr } = await supabase
        .from("opportunity_analyses")
        .update({
          human_override: selectedDecision,
          human_override_reason: overrideReason.trim(),
          human_override_by: user.id,
          human_override_at: new Date().toISOString(),
        })
        .eq("id", analysis.id);

      if (anErr) throw anErr;

      // 2. Update opportunities status accordingly
      const newStatus =
        selectedDecision === "bid"
          ? "pursuing"
          : selectedDecision === "no_bid"
            ? "no_bid"
            : "reviewing";

      const { error: oppErr } = await supabase
        .from("opportunities")
        .update({ status: newStatus })
        .eq("id", opportunity.id);

      if (oppErr) throw oppErr;

      // 3. If pursuing, ensure a bid_workspaces record exists
      if (selectedDecision === "bid") {
        const { data: existingBw } = await supabase
          .from("bid_workspaces")
          .select("id")
          .eq("opportunity_id", opportunity.id)
          .maybeSingle();

        if (!existingBw) {
          await supabase.from("bid_workspaces").insert({
            workspace_id: workspace.id,
            opportunity_id: opportunity.id,
            owner_id: user.id,
            status: "preparing",
          });
        }
      }

      toast.success("Human decision recorded.");
      setOverrideModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error("Failed to record decision", { description: (err as Error).message });
    } finally {
      setIsSavingDecision(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-xs text-muted-foreground font-mono">
              Loading intelligence report...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!opportunity) {
    return (
      <AppShell>
        <div className="p-10 text-center max-w-md mx-auto space-y-4">
          <AlertOctagon className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="font-display text-xl font-bold">Opportunity Not Found</h2>
          <p className="text-xs text-muted-foreground">
            This tender does not exist or you do not have permission to view it in this workspace.
          </p>
          <Button asChild>
            <Link to="/tenders">Return to Tenders</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const isProcessing = opportunity.analysis_status === "processing";
  const hasAnalysis = Boolean(analysis);
  const rec = analysis?.recommendation?.toLowerCase();
  const humanOverride = analysis?.human_override?.toLowerCase();
  const blockers = (analysis?.critical_blockers as string[]) || [];
  const strengths = (analysis?.strengths as string[]) || [];
  const risks = (analysis?.risks as string[]) || [];
  const missingEvidence = (analysis?.missing_evidence as string[]) || [];
  const openQuestions = (analysis?.open_questions as string[]) || [];
  const requiredActions = (analysis?.required_actions as string[]) || [];

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1 min-w-0">
              <Link to="/tenders" className="hover:text-foreground shrink-0">
                Tenders
              </Link>
              <span>/</span>
              <span
                className="text-foreground truncate max-w-[200px] sm:max-w-xs md:max-w-md"
                title={opportunity.title}
              >
                {opportunity.title}
              </span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-start sm:items-center gap-3 break-words min-w-0">
              <span className="break-words leading-tight">{opportunity.title}</span>
              {opportunity.source_url && (
                <a
                  href={opportunity.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary shrink-0 mt-1 sm:mt-0"
                  title="Open Source URL"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1.5 font-mono">
              {opportunity.buyer && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-accent" /> {opportunity.buyer}
                </span>
              )}
              {opportunity.deadline && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Due: {new Date(opportunity.deadline).toLocaleDateString()}
                </span>
              )}
              <span className="bg-secondary px-2 py-0.5 rounded text-[11px] uppercase">
                Status: {opportunity.status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTriggerAnalysis(true)}
              disabled={isProcessing || isReanalyzing}
              className="text-xs"
            >
              <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${isReanalyzing ? "animate-spin" : ""}`} />
              Re-run Analysis
            </Button>
            <Button asChild size="sm" className="text-xs bg-primary text-primary-foreground">
              <Link to="/tenders/$id/workspace" params={{ id: opportunity.id }}>
                <Briefcase className="h-3.5 w-3.5 mr-1.5" /> Bid Workspace
              </Link>
            </Button>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-border gap-6 text-sm font-medium">
          <Link
            to="/tenders/$id"
            params={{ id: opportunity.id }}
            className="pb-3 border-b-2 border-accent text-foreground font-semibold flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-accent" /> Intelligence Report
          </Link>
          <Link
            to="/tenders/$id/requirements"
            params={{ id: opportunity.id }}
            className="pb-3 text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <FileCheck className="h-4 w-4" /> Requirements Matrix
          </Link>
          <Link
            to="/tenders/$id/workspace"
            params={{ id: opportunity.id }}
            className="pb-3 text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <Briefcase className="h-4 w-4" /> Bid Workspace & Tasks
          </Link>
        </div>

        {/* PROCESSING STATE (Truthful Stage Tracking) */}
        {isProcessing && (
          <Card className="border-accent/40 bg-accent/5 shadow-panel">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground shrink-0">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div>
                  <h4 className="font-display font-semibold text-sm text-foreground">
                    Analyzing Tender Requirements
                  </h4>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    Backend Stage:{" "}
                    <span className="font-bold text-accent">
                      {opportunity.analysis_stage || "PROCESSING"}
                    </span>
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm text-right font-mono">
                Extracting RFP clauses, verifying against company capability facts, and generating
                qualification scores.
              </p>
            </CardContent>
          </Card>
        )}

        {/* FAILED STATE */}
        {!isProcessing && opportunity.analysis_status === "failed" && (
          <Card className="border-destructive/40 bg-destructive/5 shadow-panel">
            <CardContent className="p-6 flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <h4 className="font-display font-semibold text-sm text-destructive">
                  Analysis Pipeline Encountered an Error
                </h4>
                <p className="text-xs text-muted-foreground font-mono">
                  {opportunity.analysis_error || analysis?.error_message || "Execution error"}
                </p>
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTriggerAnalysis(true)}
                    className="text-xs"
                  >
                    Retry Analysis
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* UNANALYZED STATE */}
        {!isProcessing && !hasAnalysis && opportunity.analysis_status !== "failed" && (
          <Card className="border border-border bg-card shadow-panel text-center p-12 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground mx-auto">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-base">
                Ready for Intelligence Analysis
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Tender text has been indexed. Run the Phase 2 analysis engine to evaluate
                qualification scores and requirement alignment.
              </p>
            </div>
            <Button
              onClick={() => handleTriggerAnalysis(true)}
              disabled={isReanalyzing}
              className="bg-primary text-primary-foreground font-medium"
            >
              {isReanalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Launching...
                </>
              ) : (
                <>
                  Launch Intelligence Engine <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </Card>
        )}

        {/* COMPLETE INTELLIGENCE REPORT */}
        {hasAnalysis && (
          <div className="space-y-6">
            {/* 1. Core Decision Banner: BID / REVIEW / NO-BID */}
            <div
              className={`rounded-xl border p-6 md:p-8 shadow-panel relative overflow-hidden ${
                rec === "bid"
                  ? "bg-bid/10 border-bid/40"
                  : rec === "review"
                    ? "bg-review/10 border-review/40"
                    : "bg-nobid/10 border-nobid/40"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      AI Recommendation
                    </span>
                    <Badge
                      className={`font-mono font-extrabold text-sm px-3 py-1 border-0 shadow-sm flex items-center gap-1.5 ${
                        rec === "bid"
                          ? "bg-bid text-bid-foreground"
                          : rec === "review"
                            ? "bg-review text-review-foreground"
                            : "bg-nobid text-nobid-foreground"
                      }`}
                    >
                      {rec === "bid" && <CheckCircle2 className="h-4 w-4" />}
                      {rec === "review" && <HelpCircle className="h-4 w-4" />}
                      {rec === "no_bid" && <XCircle className="h-4 w-4" />}
                      {rec?.toUpperCase()}
                    </Badge>
                  </div>

                  <p className="text-base md:text-lg font-medium text-foreground leading-relaxed max-w-3xl">
                    {analysis?.reasoning || "Tender qualification scoring complete."}
                  </p>
                </div>

                {/* Score & Confidence Metric Box */}
                <div className="flex items-center gap-6 p-4 rounded-xl bg-card border border-border/80 shadow-sm shrink-0">
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                      BidRadar Score
                    </p>
                    <div className="flex items-baseline justify-center gap-1 mt-0.5">
                      <span className="font-display font-extrabold text-4xl text-foreground">
                        {analysis?.bidradar_score ?? 0}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">/100</span>
                    </div>
                  </div>

                  <div className="h-10 w-px bg-border/80" />

                  <div className="text-center">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                      Confidence
                    </p>
                    <p className="font-display font-bold text-2xl text-foreground mt-1">
                      {Math.round(Number(analysis?.confidence ?? 0) * 100)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>Deterministic Scoring Engine • Version {analysis?.version}</span>
                <span>
                  Idempotent Fingerprint: {analysis?.inputs_fingerprint?.slice(0, 8) || "active"}
                </span>
              </div>
            </div>

            {/* 2. DEDICATED HUMAN PURSUIT DECISION CARD (Decoupled from AI) */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-panel flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono uppercase font-bold text-foreground">
                    Team Pursuit Decision
                  </span>
                  {humanOverride ? (
                    <Badge
                      className={`font-mono text-xs uppercase font-extrabold ${
                        humanOverride === "bid"
                          ? "bg-bid text-bid-foreground"
                          : humanOverride === "no_bid"
                            ? "bg-nobid text-nobid-foreground"
                            : "bg-review text-review-foreground"
                      }`}
                    >
                      {humanOverride === "bid"
                        ? "PURSUING CONTRACT"
                        : humanOverride === "no_bid"
                          ? "ABANDONED (NO-BID)"
                          : "UNDER REVIEW"}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] text-muted-foreground border-muted-foreground/30"
                    >
                      PENDING HUMAN COMMITTEE DECISION
                    </Badge>
                  )}
                </div>

                {analysis?.human_override_reason ? (
                  <p className="text-xs text-foreground leading-relaxed bg-surface/60 p-2.5 rounded-lg border border-border/60">
                    <span className="font-mono font-bold text-accent uppercase text-[10px] block mb-0.5">
                      Pursuit Rationale / Business Justification:
                    </span>
                    {analysis.human_override_reason}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    The AI recommendation provides analytical intelligence. Record your
                    organization's formal pursuit decision to transition this tender into bid
                    preparation.
                  </p>
                )}

                {analysis?.human_override_at && (
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Decision logged on {new Date(analysis.human_override_at).toLocaleString()}
                  </p>
                )}
              </div>

              <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs shrink-0 self-start md:self-center"
                  >
                    {humanOverride ? "Update Decision" : "Record Pursuit Decision"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-display text-lg">
                      Record Pursuit Decision
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      The AI recommendation ({rec?.toUpperCase()}) remains archived and
                      authoritative. Record your team's decision and business rationale.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">Decision</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "bid", label: "PURSUE BID", color: "border-bid text-bid" },
                          { id: "review", label: "REVIEW", color: "border-review text-review" },
                          { id: "no_bid", label: "NO-BID", color: "border-nobid text-nobid" },
                        ].map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setSelectedDecision(d.id as "bid" | "review" | "no_bid")}
                            className={`p-2 rounded-lg border text-xs font-mono font-bold transition-all ${
                              selectedDecision === d.id
                                ? `${d.color} bg-secondary shadow-sm`
                                : "border-border text-muted-foreground hover:bg-surface"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">
                        Pursuit Rationale / Business Justification
                      </label>
                      <Textarea
                        required
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="e.g. Approved by Bid Committee due to strategic client expansion and qualified subcontractor partnership."
                        rows={4}
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setOverrideModalOpen(false)}
                      disabled={isSavingDecision}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveHumanDecision} disabled={isSavingDecision}>
                      {isSavingDecision ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      ) : null}
                      Commit Decision
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* 3. Executive Decision Summary */}
            {analysis?.executive_summary && (
              <Card className="border border-border/80 shadow-panel bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-foreground font-display font-bold text-base">
                    <Sparkles className="h-4 w-4 text-accent" /> Executive Qualification Summary
                  </div>
                  <CardDescription className="text-xs">
                    Synthesized qualification rationale, key competitive factors, and risk posture.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-xs">
                  <p className="text-foreground leading-relaxed bg-surface/40 p-4 rounded-xl border border-border/60 font-sans">
                    {analysis.executive_summary}
                  </p>

                  {analysis.recommended_strategy && (
                    <div className="p-3.5 rounded-xl border border-accent/20 bg-accent/5 space-y-1">
                      <span className="font-mono text-[10px] font-bold uppercase text-accent">
                        Recommended Bid Strategy:
                      </span>
                      <p className="text-muted-foreground leading-relaxed">
                        {analysis.recommended_strategy}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 2. Critical Blockers (Destructive Alert if present) */}
            {blockers.length > 0 && (
              <Card className="border-destructive/60 bg-destructive/5 shadow-panel">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-destructive font-display font-bold text-base">
                    <ShieldAlert className="h-5 w-5" /> Critical Blockers Detected (
                    {blockers.length})
                  </div>
                  <CardDescription className="text-xs text-destructive/80">
                    Mandatory RFP disqualifiers or non-compliant threshold criteria.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {blockers.map((blocker, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-3 rounded-lg border border-destructive/20 bg-card text-xs text-foreground"
                    >
                      <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <span>{blocker}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 3. Deterministic Score Breakdown (8 Dimensions) */}
            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-display text-lg">
                      Deterministic Score Components
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Authoritative evaluation across 8 dimensions derived by the Phase 2 scoring
                      engine.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {components.length} Evaluated Dimensions
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {components.map((comp) => {
                    const contribution = comp.score * comp.weight;
                    const isBlocking = comp.blocking;

                    return (
                      <div
                        key={comp.key}
                        className={`p-4 rounded-xl border transition-all ${
                          isBlocking
                            ? "border-destructive/40 bg-destructive/5"
                            : "border-border/60 bg-surface/40 hover:bg-surface/70"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-semibold text-sm text-foreground">
                              {comp.label}
                            </span>
                            {isBlocking && (
                              <Badge
                                variant="destructive"
                                className="text-[9px] font-mono py-0 px-1"
                              >
                                BLOCKING
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-baseline gap-1 font-mono text-xs">
                            <span className="font-bold text-foreground">{comp.score}</span>
                            <span className="text-muted-foreground">/100</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full ${
                              isBlocking
                                ? "bg-destructive"
                                : comp.score >= 70
                                  ? "bg-bid"
                                  : comp.score >= 50
                                    ? "bg-review"
                                    : "bg-nobid"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, comp.score))}%` }}
                          />
                        </div>

                        {comp.rationale && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {comp.rationale}
                          </p>
                        )}

                        <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                          <span>Weight: {Math.round(comp.weight * 100)}%</span>
                          <span>Contribution: {contribution.toFixed(1)} pts</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 4. Strengths & Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strengths */}
              <Card className="border border-border/80 shadow-panel bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-bid font-display font-bold text-base">
                    <CheckCircle2 className="h-4 w-4" /> Strategic Strengths ({strengths.length})
                  </div>
                  <CardDescription className="text-xs">
                    Verified qualifications and competitive advantages.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {strengths.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No distinct strengths registered.
                    </p>
                  ) : (
                    strengths.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-border/60 bg-surface/40 text-xs leading-relaxed flex items-start gap-2"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-bid mt-1.5 shrink-0" />
                        <span>{s}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Risks */}
              <Card className="border border-border/80 shadow-panel bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-review font-display font-bold text-base">
                    <AlertTriangle className="h-4 w-4" /> Identified Risks ({risks.length})
                  </div>
                  <CardDescription className="text-xs">
                    Potential gaps, commercial exposures, and execution hazards.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {risks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No significant risks flagged.
                    </p>
                  ) : (
                    risks.map((r, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-border/60 bg-surface/40 text-xs leading-relaxed flex items-start gap-2"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-review mt-1.5 shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 5. Missing Evidence & Open Questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Missing Evidence */}
              <Card className="border border-border/80 shadow-panel bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-accent font-display font-bold text-base">
                    <HelpCircle className="h-4 w-4" /> Missing Evidence ({missingEvidence.length})
                  </div>
                  <CardDescription className="text-xs">
                    Certifications, project references, or facts needed to verify compliance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {missingEvidence.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No missing evidence items recorded.
                    </p>
                  ) : (
                    missingEvidence.map((me, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-border/60 bg-surface/40 text-xs leading-relaxed flex items-start gap-2"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                        <span>{me}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Open Questions */}
              <Card className="border border-border/80 shadow-panel bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-foreground font-display font-bold text-base">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" /> Open Procurement
                    Questions ({openQuestions.length})
                  </div>
                  <CardDescription className="text-xs">
                    Ambiguities in the tender notice recommended for formal bidder queries.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {openQuestions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No open clarification questions noted.
                    </p>
                  ) : (
                    openQuestions.map((oq, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-border/60 bg-surface/40 text-xs leading-relaxed flex items-start gap-2"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                        <span>{oq}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 6. Actionable Next Steps (Ground in required_actions) */}
            {requiredActions.length > 0 && (
              <Card className="border border-border/80 shadow-panel bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-foreground font-display font-bold text-base">
                    <ListTodo className="h-4 w-4 text-accent" /> Actionable Next Steps (
                    {requiredActions.length})
                  </div>
                  <CardDescription className="text-xs">
                    Immediate qualification actions, evidence location tasks, and deadline
                    confirmations recommended by the analysis.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {requiredActions.map((action, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-border/60 bg-surface/40 text-xs leading-relaxed flex items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-accent font-mono text-[10px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-foreground">{action}</span>
                      </div>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs font-mono shrink-0"
                      >
                        <Link to="/tenders/$id/workspace" params={{ id: opportunity.id }}>
                          Create Task <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 7. Action Call to Action */}
            <Card className="border border-border bg-card shadow-panel p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-base text-foreground">
                    Next Step: Requirements Inspection & Bid Preparation
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Review extracted line-item requirements in the matrix or assign tasks in the Bid
                    Workspace.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/tenders/$id/requirements" params={{ id: opportunity.id }}>
                      <FileCheck className="h-4 w-4 mr-1.5" /> Requirements Matrix
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Link to="/tenders/$id/workspace" params={{ id: opportunity.id }}>
                      <Briefcase className="h-4 w-4 mr-1.5" /> Open Bid Workspace
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
