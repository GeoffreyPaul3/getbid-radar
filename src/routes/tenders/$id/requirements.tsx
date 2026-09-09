import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Search,
  FileCheck,
  Briefcase,
  Sparkles,
  ArrowRight,
  Loader2,
  Building2,
  FileText,
  Clock,
  ShieldAlert,
  PlusCircle,
  ExternalLink,
  SlidersHorizontal,
  FileBarChart,
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
type OpportunityRequirement = Database["public"]["Tables"]["opportunity_requirements"]["Row"];

export const Route = createFileRoute("/tenders/$id/requirements")({
  component: RequirementsMatrixPage,
});

function MatchBadge({ match, status }: { match?: string | null; status?: string | null }) {
  const norm = (match || status || "").toUpperCase();

  if (norm === "MATCH" || norm === "PASS") {
    return (
      <Badge className="bg-bid text-bid-foreground font-mono font-bold text-[10px] px-2 py-0.5 border-0 shadow-sm flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> MATCH
      </Badge>
    );
  }
  if (norm === "PARTIAL") {
    return (
      <Badge className="bg-review text-review-foreground font-mono font-bold text-[10px] px-2 py-0.5 border-0 shadow-sm flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> PARTIAL
      </Badge>
    );
  }
  if (norm === "NO_MATCH" || norm === "FAIL" || norm === "MISSING") {
    return (
      <Badge className="bg-nobid text-nobid-foreground font-mono font-bold text-[10px] px-2 py-0.5 border-0 shadow-sm flex items-center gap-1">
        <XCircle className="h-3 w-3" /> NO_MATCH
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="font-mono text-[10px] uppercase border-muted-foreground/40 text-muted-foreground flex items-center gap-1"
    >
      <HelpCircle className="h-3 w-3" /> UNKNOWN
    </Badge>
  );
}

function RequirementsMatrixPage() {
  const { id } = useParams({ from: "/tenders/$id/requirements" });
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [requirements, setRequirements] = useState<OpportunityRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [matchFilter, setMatchFilter] = useState("all");
  const [importanceFilter, setImportanceFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState<
    "all" | "mandatory" | "gaps" | "uncertain" | "deadlines"
  >("all");

  // Detail Drawer & Task Creation
  const [selectedReq, setSelectedReq] = useState<OpportunityRequirement | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high" | "critical">(
    "medium",
  );
  const [taskDueDate, setTaskDueDate] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  useEffect(() => {
    async function loadRequirements() {
      if (!id || !workspace) return;
      setIsLoading(true);
      try {
        const { data: opp, error: oppErr } = await supabase
          .from("opportunities")
          .select("*")
          .eq("id", id)
          .eq("workspace_id", workspace.id)
          .maybeSingle();

        if (oppErr) throw oppErr;
        setOpportunity(opp);

        const { data: reqs, error: reqErr } = await supabase
          .from("opportunity_requirements")
          .select("*")
          .eq("opportunity_id", id)
          .eq("workspace_id", workspace.id)
          .order("is_mandatory", { ascending: false });

        if (reqErr) throw reqErr;
        setRequirements(reqs ?? []);
      } catch (err) {
        console.error("[Requirements] Load failed:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadRequirements();
  }, [id, workspace]);

  const categories = Array.from(
    new Set(requirements.map((r) => r.category || r.req_type).filter(Boolean)),
  );

  const filtered = requirements.filter((r) => {
    const textMatches =
      !searchQuery.trim() ||
      r.requirement.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.reasoning && r.reasoning.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.evidence && r.evidence.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.source_section && r.source_section.toLowerCase().includes(searchQuery.toLowerCase()));

    const catMatches =
      categoryFilter === "all" || r.category === categoryFilter || r.req_type === categoryFilter;

    const normMatch = (r.company_match || r.status || "").toUpperCase();
    const matchFilterPass =
      matchFilter === "all" ||
      (matchFilter === "MATCH" && (normMatch === "MATCH" || normMatch === "PASS")) ||
      (matchFilter === "PARTIAL" && normMatch === "PARTIAL") ||
      (matchFilter === "NO_MATCH" &&
        (normMatch === "NO_MATCH" || normMatch === "FAIL" || normMatch === "MISSING")) ||
      (matchFilter === "UNKNOWN" &&
        (normMatch === "UNKNOWN" || normMatch === "NEEDS_REVIEW" || !normMatch));

    const impMatches =
      importanceFilter === "all" || r.importance.toLowerCase() === importanceFilter.toLowerCase();

    let scopeMatches = true;
    if (scopeFilter === "mandatory") scopeMatches = Boolean(r.is_mandatory);
    else if (scopeFilter === "gaps")
      scopeMatches = normMatch === "NO_MATCH" || normMatch === "FAIL" || normMatch === "MISSING";
    else if (scopeFilter === "uncertain")
      scopeMatches =
        normMatch === "UNKNOWN" || normMatch === "NEEDS_REVIEW" || Boolean(r.is_ambiguous);
    else if (scopeFilter === "deadlines") scopeMatches = Boolean(r.due_date);

    return textMatches && catMatches && matchFilterPass && impMatches && scopeMatches;
  });

  const matchCount = requirements.filter((r) => {
    const m = (r.company_match || r.status || "").toUpperCase();
    return m === "MATCH" || m === "PASS";
  }).length;
  const partialCount = requirements.filter(
    (r) => (r.company_match || r.status || "").toUpperCase() === "PARTIAL",
  ).length;
  const noMatchCount = requirements.filter((r) => {
    const m = (r.company_match || r.status || "").toUpperCase();
    return m === "NO_MATCH" || m === "FAIL" || m === "MISSING";
  }).length;
  const unknownCount = requirements.length - matchCount - partialCount - noMatchCount;

  const handleOpenDetail = (req: OpportunityRequirement) => {
    setSelectedReq(req);
    setDetailModalOpen(true);
  };

  const handleOpenCreateTask = (req: OpportunityRequirement) => {
    setSelectedReq(req);
    setTaskTitle(`Address requirement: ${req.requirement.slice(0, 60)}`);
    setTaskDescription(
      req.action_required ||
        req.evidence_needed ||
        `Verify evidence and prepare compliance response for clause.`,
    );
    setTaskPriority(
      req.importance === "critical" ? "critical" : req.importance === "high" ? "high" : "medium",
    );
    setTaskDueDate(req.due_date ? req.due_date.slice(0, 10) : "");
    setCreateTaskModalOpen(true);
  };

  const handleCreateTaskForReq = async () => {
    if (!selectedReq || !workspace || !opportunity) return;
    setIsCreatingTask(true);
    try {
      let bwId: string | null = null;
      const { data: existingBw } = await supabase
        .from("bid_workspaces")
        .select("id")
        .eq("opportunity_id", opportunity.id)
        .maybeSingle();

      if (existingBw) {
        bwId = existingBw.id;
      } else {
        const { data: newBw, error: bwErr } = await supabase
          .from("bid_workspaces")
          .insert({
            workspace_id: workspace.id,
            opportunity_id: opportunity.id,
            status: "preparing",
          })
          .select("id")
          .single();
        if (bwErr) throw bwErr;
        bwId = newBw.id;
      }

      const { error: taskErr } = await supabase.from("bid_tasks").insert({
        workspace_id: workspace.id,
        bid_workspace_id: bwId,
        requirement_id: selectedReq.id,
        title: taskTitle.trim() || `Address requirement: ${selectedReq.requirement.slice(0, 60)}`,
        description: taskDescription.trim() || null,
        priority: taskPriority,
        status: "todo",
        due_date: taskDueDate || null,
      });

      if (taskErr) throw taskErr;

      toast.success("Task created in Bid Workspace and linked to requirement!");
      setCreateTaskModalOpen(false);
      setDetailModalOpen(false);
    } catch (err) {
      toast.error("Failed to create task", { description: (err as Error).message });
    } finally {
      setIsCreatingTask(false);
    }
  };

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1 min-w-0">
            <Link to="/tenders" className="hover:text-foreground shrink-0">
              Tenders
            </Link>
            <span>/</span>
            <Link
              to="/tenders/$id"
              params={{ id: id || "" }}
              className="hover:text-foreground truncate max-w-[200px] sm:max-w-xs md:max-w-md"
              title={opportunity?.title}
            >
              {opportunity?.title || "Tender"}
            </Link>
            <span>/</span>
            <span className="text-foreground shrink-0">Requirements Matrix</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <span>Requirements Compliance Matrix</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Tender requirements extracted by AI, mapped to verified company evidence.
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-border gap-6 text-sm font-medium">
          <Link
            to="/tenders/$id"
            params={{ id: id || "" }}
            className="pb-3 text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <FileBarChart className="h-4 w-4" /> Intelligence Report
          </Link>
          <Link
            to="/tenders/$id/requirements"
            params={{ id: id || "" }}
            className="pb-3 border-b-2 border-accent text-foreground font-semibold flex items-center gap-2"
          >
            <FileCheck className="h-4 w-4 text-accent" /> Requirements Matrix ({requirements.length}
            )
          </Link>
          <Link
            to="/tenders/$id/workspace"
            params={{ id: id || "" }}
            className="pb-3 text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <Briefcase className="h-4 w-4" /> Bid Workspace & Tasks
          </Link>
        </div>

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-bid/30 bg-bid/5 text-center">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">Full Match</p>
            <p className="font-display text-2xl font-bold text-bid mt-0.5">{matchCount}</p>
          </div>
          <div className="p-4 rounded-xl border border-review/30 bg-review/5 text-center">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">Partial Match</p>
            <p className="font-display text-2xl font-bold text-review mt-0.5">{partialCount}</p>
          </div>
          <div className="p-4 rounded-xl border border-nobid/30 bg-nobid/5 text-center">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">Gap / No Match</p>
            <p className="font-display text-2xl font-bold text-nobid mt-0.5">{noMatchCount}</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">
              Unknown / Pending
            </p>
            <p className="font-display text-2xl font-bold text-foreground mt-0.5">{unknownCount}</p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search extracted clauses, evidence, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-card text-xs"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-44 h-10 bg-card text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c!} value={c!}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={matchFilter} onValueChange={setMatchFilter}>
              <SelectTrigger className="w-full md:w-44 h-10 bg-card text-xs">
                <SelectValue placeholder="Compliance Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="MATCH">MATCH</SelectItem>
                <SelectItem value="PARTIAL">PARTIAL</SelectItem>
                <SelectItem value="NO_MATCH">NO_MATCH</SelectItem>
                <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
              </SelectContent>
            </Select>

            <Select value={importanceFilter} onValueChange={setImportanceFilter}>
              <SelectTrigger className="w-full md:w-36 h-10 bg-card text-xs">
                <SelectValue placeholder="Importance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Importance</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Scope Filters */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 mr-1">
              <SlidersHorizontal className="h-3 w-3" /> Focus:
            </span>
            {[
              { id: "all", label: "All Clauses" },
              { id: "mandatory", label: "Mandatory Only" },
              { id: "gaps", label: "Confirmed Gaps (NO_MATCH)" },
              { id: "uncertain", label: "Uncertain / Ambiguous" },
              { id: "deadlines", label: "Deadline Sensitive" },
            ].map((scope) => (
              <button
                key={scope.id}
                onClick={() =>
                  setScopeFilter(
                    scope.id as "all" | "mandatory" | "gaps" | "uncertain" | "deadlines",
                  )
                }
                className={`px-2.5 py-1 rounded-full text-xs font-mono transition-all ${
                  scopeFilter === scope.id
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "bg-surface text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/60"
                }`}
              >
                {scope.label}
              </button>
            ))}
          </div>
        </div>

        {/* Requirements List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-card rounded-xl border border-border">
            <Loader2 className="h-8 w-8 animate-spin text-accent mb-2" />
            <p className="text-xs text-muted-foreground font-mono">Loading compliance matrix...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border border-border bg-card p-12 text-center">
            <p className="text-sm font-semibold text-foreground">No matching requirements</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try broadening your filter criteria or search query.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => {
              const isMandatory = req.is_mandatory;
              const sourceRef = [
                req.source_reference,
                req.source_page ? `p. ${req.source_page}` : null,
                req.source_section ? `§ ${req.source_section}` : null,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <div
                  key={req.id}
                  className={`p-5 rounded-xl border bg-card shadow-sm transition-all hover:border-accent/40 cursor-pointer ${
                    isMandatory ? "border-l-4 border-l-accent" : "border-border/80"
                  }`}
                  onClick={() => handleOpenDetail(req)}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <MatchBadge match={req.company_match} status={req.status} />

                      {isMandatory && (
                        <Badge
                          variant="destructive"
                          className="font-mono text-[9px] py-0 px-1.5 uppercase font-bold"
                        >
                          Mandatory Blocker
                        </Badge>
                      )}

                      {req.category && (
                        <span className="font-mono text-[10px] uppercase bg-secondary px-2 py-0.5 rounded text-foreground font-medium">
                          {req.category}
                        </span>
                      )}

                      {req.importance && (
                        <span
                          className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded border ${
                            req.importance === "critical"
                              ? "border-destructive/40 text-destructive bg-destructive/5"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {req.importance}
                        </span>
                      )}

                      {req.threshold_value && (
                        <span className="font-mono text-[10px] text-muted-foreground bg-surface px-1.5 py-0.5 rounded border">
                          Threshold: {req.threshold_value}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono shrink-0">
                      {req.match_confidence != null && (
                        <span>Confidence: {Math.round(Number(req.match_confidence) * 100)}%</span>
                      )}
                      {sourceRef && (
                        <span className="flex items-center gap-1 text-[11px] bg-secondary/60 px-1.5 py-0.5 rounded">
                          <FileText className="h-3 w-3" /> {sourceRef}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Requirement Text */}
                  <h3 className="font-display font-semibold text-sm text-foreground leading-relaxed">
                    {req.requirement}
                  </h3>

                  {/* Reasoning & Evidence Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/40 text-xs">
                    {req.reasoning && (
                      <div className="space-y-1">
                        <span className="font-mono uppercase text-[10px] font-bold text-muted-foreground">
                          Compliance Assessment:
                        </span>
                        <p className="text-muted-foreground leading-relaxed">{req.reasoning}</p>
                      </div>
                    )}

                    {req.evidence && (
                      <div className="space-y-1">
                        <span className="font-mono uppercase text-[10px] font-bold text-bid flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Verified Evidence:
                        </span>
                        <p className="text-foreground leading-relaxed bg-surface/50 p-2 rounded border border-border/40 font-mono text-[11px]">
                          {req.evidence}
                        </p>
                      </div>
                    )}

                    {req.evidence_needed && (
                      <div className="space-y-1">
                        <span className="font-mono uppercase text-[10px] font-bold text-accent flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Missing Evidence:
                        </span>
                        <p className="text-muted-foreground leading-relaxed bg-accent/5 p-2 rounded border border-accent/20">
                          {req.evidence_needed}
                        </p>
                      </div>
                    )}

                    {req.action_required && (
                      <div className="space-y-1">
                        <span className="font-mono uppercase text-[10px] font-bold text-foreground">
                          Recommended Action:
                        </span>
                        <p className="text-muted-foreground leading-relaxed">
                          {req.action_required}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="mt-3 pt-2 border-t border-border/30 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-accent">
                      Click to inspect full audit trace & citation
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCreateTask(req);
                      }}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground font-mono"
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1 text-accent" /> Create Task
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* REQUIREMENT DETAIL MODAL / DRAWER */}
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            {selectedReq && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <MatchBadge match={selectedReq.company_match} status={selectedReq.status} />
                    <span className="font-mono text-xs uppercase text-muted-foreground">
                      {selectedReq.category || "General Requirement"}
                    </span>
                    {selectedReq.is_mandatory && (
                      <Badge variant="destructive" className="font-mono text-[10px]">
                        MANDATORY BLOCKER
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="font-display text-lg text-foreground leading-snug">
                    {selectedReq.requirement}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2 text-xs">
                  {/* Tender Citation */}
                  <div className="p-3.5 rounded-xl border border-border/80 bg-surface/60 space-y-1.5">
                    <span className="font-mono font-bold uppercase text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-accent" /> Exact Tender Citation
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                      <div>
                        <span className="text-muted-foreground">Source:</span>{" "}
                        <span className="font-semibold">
                          {selectedReq.source_reference || "Tender Document"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Page:</span>{" "}
                        <span className="font-semibold">
                          {selectedReq.source_page ?? "Not specified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Section:</span>{" "}
                        <span className="font-semibold">
                          {selectedReq.source_section ?? "General Scope"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Threshold & Interpretation */}
                  {selectedReq.threshold_value && (
                    <div className="p-3 rounded-lg border border-border/60 bg-card space-y-1">
                      <span className="font-mono font-bold uppercase text-[10px] text-muted-foreground">
                        Mandatory Specification / Threshold:
                      </span>
                      <p className="font-mono text-foreground">{selectedReq.threshold_value}</p>
                    </div>
                  )}

                  {/* Company Match & Evidence */}
                  <div className="space-y-2">
                    <span className="font-mono font-bold uppercase text-[10px] text-foreground">
                      Company Compliance & Evidence Trace
                    </span>
                    <div className="p-3 rounded-lg border border-border/60 bg-card space-y-2">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span>
                          Match Confidence:{" "}
                          <strong>
                            {Math.round(Number(selectedReq.match_confidence ?? 0) * 100)}%
                          </strong>
                        </span>
                        <span>
                          Extraction Confidence:{" "}
                          <strong>
                            {Math.round(Number(selectedReq.extraction_confidence ?? 0) * 100)}%
                          </strong>
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {selectedReq.reasoning ||
                          "Evaluation derived from comparison against company profile parameters."}
                      </p>
                      {selectedReq.evidence && (
                        <div className="pt-2 border-t border-border/40">
                          <span className="font-mono text-[10px] text-bid font-bold uppercase block mb-1">
                            Verified Corporate Evidence:
                          </span>
                          <p className="font-mono text-[11px] text-foreground bg-surface/80 p-2 rounded border border-border/40">
                            {selectedReq.evidence}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Evidence Gap Analysis (Truthful distinction) */}
                  <div className="p-3.5 rounded-xl border border-accent/30 bg-accent/5 space-y-1.5">
                    <span className="font-mono font-bold uppercase text-[10px] text-accent flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" /> Evidence Gap Status
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      {selectedReq.evidence_needed ? (
                        <span>
                          <strong>Not Found in Knowledge Base:</strong>{" "}
                          {selectedReq.evidence_needed}
                        </span>
                      ) : (
                        <span>
                          All necessary qualification evidence has been matched against active
                          corporate records.
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Recommended Action */}
                  {selectedReq.action_required && (
                    <div className="p-3 rounded-lg border border-border/60 bg-card space-y-1">
                      <span className="font-mono font-bold uppercase text-[10px] text-foreground">
                        Recommended Next Action:
                      </span>
                      <p className="text-muted-foreground leading-relaxed">
                        {selectedReq.action_required}
                      </p>
                    </div>
                  )}
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                  <Button variant="outline" size="sm" onClick={() => setDetailModalOpen(false)}>
                    Close
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground font-mono text-xs"
                    onClick={() => {
                      setDetailModalOpen(false);
                      handleOpenCreateTask(selectedReq);
                    }}
                  >
                    <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Create Task in Workspace
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* CREATE TASK MODAL (Directly linked to requirement_id) */}
        <Dialog open={createTaskModalOpen} onOpenChange={setCreateTaskModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">Create Requirement Task</DialogTitle>
              <DialogDescription className="text-xs">
                Link an actionable task to this tender requirement clause in the Bid Workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Task Title</label>
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Gather ISO 27001 certificate..."
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Description & Instructions</label>
                <Textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Specific instructions or missing evidence to locate..."
                  rows={3}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Priority</label>
                  <Select
                    value={taskPriority}
                    onValueChange={(v: string) =>
                      setTaskPriority(v as "low" | "medium" | "high" | "critical")
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Due Date</label>
                  <Input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateTaskModalOpen(false)}
                disabled={isCreatingTask}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateTaskForReq}
                disabled={isCreatingTask}
                className="bg-primary text-primary-foreground font-mono text-xs"
              >
                {isCreatingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Create Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
