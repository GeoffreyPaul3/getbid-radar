import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Briefcase,
  PlusCircle,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Sparkles,
  Loader2,
  Trash2,
  FileText,
  Building2,
  ListTodo,
  FileBarChart,
  AlertTriangle,
  Target,
  Columns3,
  List,
  ChevronRight,
  Timer,
  ShieldCheck,
  Save,
  XCircle,
  ArrowUpRight,
  Send,
  Trophy,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { ProposalWorkspaceTab } from "@/components/workspace/ProposalWorkspaceTab";
import { ComplianceAuditTab } from "@/components/workspace/ComplianceAuditTab";
import { SubmissionTrackingTab } from "@/components/workspace/SubmissionTrackingTab";
import { OutcomesLearningTab } from "@/components/workspace/OutcomesLearningTab";
import type { Database } from "@/integrations/supabase/types";
import {
  calculateReadiness,
  readinessStatusLabel,
  readinessStatusColor,
  readinessStatusBorder,
  type ReadinessTask,
  type ReadinessRequirement,
  type ReadinessProposal,
} from "@/lib/bid-workspace/readiness";

type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
type BidWorkspace = Database["public"]["Tables"]["bid_workspaces"]["Row"];
type BidTask = Database["public"]["Tables"]["bid_tasks"]["Row"];
type OpportunityRequirement = Database["public"]["Tables"]["opportunity_requirements"]["Row"];
type ProposalDocument = Database["public"]["Tables"]["proposal_documents"]["Row"];

export const Route = createFileRoute("/tenders/$id/workspace")({
  component: BidWorkspacePage,
});

// ─────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const p = priority.toLowerCase();
  if (p === "critical")
    return (
      <Badge variant="destructive" className="font-mono text-[9px]">
        CRITICAL
      </Badge>
    );
  if (p === "high")
    return <Badge className="bg-review text-review-foreground font-mono text-[9px]">HIGH</Badge>;
  if (p === "medium")
    return (
      <Badge variant="secondary" className="font-mono text-[9px]">
        MEDIUM
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground font-mono text-[9px]">
      LOW
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "completed")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-mono text-[9px]">
        COMPLETED
      </Badge>
    );
  if (s === "in_progress")
    return (
      <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 font-mono text-[9px]">
        IN PROGRESS
      </Badge>
    );
  if (s === "blocked")
    return (
      <Badge variant="destructive" className="font-mono text-[9px] opacity-90">
        BLOCKED
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground font-mono text-[9px]">
      TO DO
    </Badge>
  );
}

// ─────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────

import { useRequireAuth } from "@/lib/use-require-auth";

function BidWorkspacePage() {
  const { id } = useParams({ from: "/tenders/$id/workspace" });
  const { isReady, AuthLoadingFallback, user, workspace } = useRequireAuth();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [bidWorkspace, setBidWorkspace] = useState<BidWorkspace | null>(null);
  const [tasks, setTasks] = useState<BidTask[]>([]);
  const [requirements, setRequirements] = useState<OpportunityRequirement[]>([]);
  const [proposals, setProposals] = useState<ProposalDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View mode: "kanban" | "list"
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list");

  // Active Workspace Sub-Tab
  const [activeTab, setActiveTab] = useState<
    "tasks" | "proposal" | "compliance" | "submission" | "outcomes"
  >("tasks");

  // New Task Dialog
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high" | "critical">(
    "medium",
  );
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskRequirementId, setTaskRequirementId] = useState<string>("none");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Workspace Notes
  const [notes, setNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // New Document Dialog
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);

  // ──── Data loading ────────────────────────────────────────────
  const loadWorkspaceData = useCallback(async () => {
    if (!id || !workspace) return;
    setIsLoading(true);
    try {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      setOpportunity(opp);

      let { data: bw } = await supabase
        .from("bid_workspaces")
        .select("*")
        .eq("opportunity_id", id)
        .eq("workspace_id", workspace.id)
        .maybeSingle();

      if (!bw && user) {
        const { data: createdBw } = await supabase
          .from("bid_workspaces")
          .insert({
            workspace_id: workspace.id,
            opportunity_id: id,
            owner_id: user.id,
            status: "preparing",
            notes: "Bid preparation workspace established.",
          })
          .select()
          .single();
        bw = createdBw;
      }
      setBidWorkspace(bw ?? null);
      setNotes(bw?.notes || "");

      if (bw) {
        const { data: taskRows } = await supabase
          .from("bid_tasks")
          .select("*")
          .eq("bid_workspace_id", bw.id)
          .order("created_at", { ascending: false });
        setTasks(taskRows ?? []);

        const { data: docRows } = await supabase
          .from("proposal_documents")
          .select("*")
          .eq("bid_workspace_id", bw.id)
          .order("created_at", { ascending: false });
        setProposals(docRows ?? []);
      }

      const { data: reqRows } = await supabase
        .from("opportunity_requirements")
        .select("*")
        .eq("opportunity_id", id)
        .eq("workspace_id", workspace.id);
      setRequirements(reqRows ?? []);
    } catch (err) {
      console.error("[Workspace] Load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [id, workspace, user]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // ──── Deterministic Readiness Calculation ──────────────────────
  const readinessReport = useMemo(() => {
    const readinessReqs: ReadinessRequirement[] = requirements.map((r) => ({
      id: r.id,
      requirement: r.requirement,
      category: r.category ?? null,
      is_mandatory: r.is_mandatory ?? false,
      evidence_status: r.company_match ?? (r.status as string) ?? null,
    }));

    const readinessTasks: ReadinessTask[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as ReadinessTask["status"],
      priority: t.priority,
      due_date: t.due_date ?? null,
      requirement_id: t.requirement_id ?? null,
    }));

    const readinessProposals: ReadinessProposal[] = proposals.map((p) => ({
      id: p.id,
      title: p.title,
    }));

    return calculateReadiness({
      requirements: readinessReqs,
      tasks: readinessTasks,
      proposals: readinessProposals,
      submissionDeadline: opportunity?.deadline ?? null,
    });
  }, [requirements, tasks, proposals, opportunity]);

  // ──── Handlers ────────────────────────────────────────────────
  const handleCreateTask = async (e: React.FormEvent, prelinkedReqId?: string) => {
    e.preventDefault();
    if (!taskTitle.trim() || !bidWorkspace || !workspace || !user) return;

    setIsCreatingTask(true);
    const reqId = prelinkedReqId ?? (taskRequirementId === "none" ? null : taskRequirementId);
    try {
      const { error } = await supabase.from("bid_tasks").insert({
        workspace_id: workspace.id,
        bid_workspace_id: bidWorkspace.id,
        owner_id: user.id,
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        priority: taskPriority,
        status: "todo",
        due_date: taskDueDate ? new Date(taskDueDate).toISOString() : null,
        requirement_id: reqId,
      });

      if (error) throw error;

      toast.success("Task added to workspace");
      setNewTaskOpen(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskDueDate("");
      setTaskRequirementId("none");
      await loadWorkspaceData();
    } catch (err) {
      toast.error("Failed to create task", { description: (err as Error).message });
    } finally {
      setIsCreatingTask(false);
    }
  };

  const openTaskForGap = (reqId: string, reqText: string) => {
    setTaskTitle(`Address gap: ${reqText.slice(0, 60)}`);
    setTaskRequirementId(reqId);
    setTaskPriority("high");
    setNewTaskOpen(true);
  };

  const handleUpdateTaskStatus = async (
    taskId: string,
    newStatus: "todo" | "in_progress" | "blocked" | "completed",
  ) => {
    try {
      const { error } = await supabase
        .from("bid_tasks")
        .update({ status: newStatus })
        .eq("id", taskId);
      if (error) throw error;
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    } catch (err) {
      toast.error("Failed to update status", { description: (err as Error).message });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from("bid_tasks").delete().eq("id", taskId);
      if (error) throw error;
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success("Task deleted");
    } catch (err) {
      toast.error("Failed to delete task", { description: (err as Error).message });
    }
  };

  const handleSaveNotes = async () => {
    if (!bidWorkspace) return;
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from("bid_workspaces")
        .update({ notes })
        .eq("id", bidWorkspace.id);
      if (error) throw error;
      toast.success("Workspace notes updated");
    } catch (err) {
      toast.error("Failed to save notes", { description: (err as Error).message });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !bidWorkspace || !workspace || !user) return;

    setIsCreatingDoc(true);
    try {
      const { error } = await supabase.from("proposal_documents").insert({
        workspace_id: workspace.id,
        bid_workspace_id: bidWorkspace.id,
        created_by: user.id,
        title: docTitle.trim(),
        content: docContent.trim(),
        version: 1,
        is_current: true,
      });

      if (error) throw error;
      toast.success("Proposal document drafted");
      setNewDocOpen(false);
      setDocTitle("");
      setDocContent("");
      await loadWorkspaceData();
    } catch (err) {
      toast.error("Failed to create document", { description: (err as Error).message });
    } finally {
      setIsCreatingDoc(false);
    }
  };

  // ──── Loading state ────────────────────────────────────────────
  if (!isReady) return AuthLoadingFallback;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppShell>
    );
  }

  // ──── Derived data ────────────────────────────────────────────
  const { deadlineIntelligence, status, score, breakdown, criticalGaps } = readinessReport;
  const dl = deadlineIntelligence;

  const KANBAN_COLUMNS = [
    { key: "todo" as const, label: "To Do", color: "text-muted-foreground" },
    { key: "in_progress" as const, label: "In Progress", color: "text-blue-500" },
    { key: "blocked" as const, label: "Blocked", color: "text-destructive" },
    { key: "completed" as const, label: "Completed", color: "text-emerald-500" },
  ];

  const urgencyConfig = {
    none: { color: "text-muted-foreground", bg: "" },
    safe: {
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/30",
    },
    warning: {
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
    },
    critical: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
    overdue: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
  };
  const ug = urgencyConfig[dl.urgencyLevel];

  return (
    <AppShell>
      <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">
              <Link to="/tenders" className="hover:text-foreground shrink-0">
                Tenders
              </Link>
              <ChevronRight className="h-3 w-3" />
              <Link
                to="/tenders/$id"
                params={{ id: id || "" }}
                className="hover:text-foreground truncate max-w-[200px] sm:max-w-xs"
                title={opportunity?.title}
              >
                {opportunity?.title || "Tender"}
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground shrink-0">Bid Command Center</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex flex-wrap items-center gap-3">
              <span>Bid Command Center</span>
              <Badge variant="outline" className="font-mono text-xs text-accent border-accent">
                {opportunity?.status?.toUpperCase() ?? "ACTIVE"}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Operational submission intelligence — deadline tracking, readiness verification, task
              execution, and proposal preparation.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View switcher */}
            <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-white font-semibold"
                    : "bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className={`h-3.5 w-3.5 ${viewMode === "list" ? "text-white" : "text-muted-foreground"}`} /> List
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
                  viewMode === "kanban"
                    ? "bg-primary text-white font-semibold"
                    : "bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                <Columns3 className={`h-3.5 w-3.5 ${viewMode === "kanban" ? "text-white" : "text-muted-foreground"}`} /> Kanban
              </button>
            </div>

            <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-primary text-white hover:bg-primary/90 font-semibold shadow-sm"
                >
                  <PlusCircle className="h-4 w-4 mr-1.5 text-white" /> Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreateTask}>
                  <DialogHeader>
                    <DialogTitle className="font-display text-lg">Add Bid Task</DialogTitle>
                    <DialogDescription className="text-xs">
                      Assign a deliverable, compliance task, or pricing activity.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-3">
                    <div className="space-y-1">
                      <Label htmlFor="task-t" className="text-xs">
                        Task Title *
                      </Label>
                      <Input
                        id="task-t"
                        required
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="e.g. Obtain ISO 27001 certificate audit copy"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Priority</Label>
                        <Select
                          value={taskPriority}
                          onValueChange={(v) =>
                            setTaskPriority(v as "low" | "medium" | "high" | "critical")
                          }
                        >
                          <SelectTrigger className="h-9">
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
                      <div className="space-y-1">
                        <Label htmlFor="task-due" className="text-xs">
                          Due Date
                        </Label>
                        <Input
                          id="task-due"
                          type="date"
                          value={taskDueDate}
                          onChange={(e) => setTaskDueDate(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Link to RFP Requirement</Label>
                      <Select value={taskRequirementId} onValueChange={setTaskRequirementId}>
                        <SelectTrigger className="h-9 truncate">
                          <SelectValue placeholder="Select requirement..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          <SelectItem value="none">None (General Task)</SelectItem>
                          {requirements.map((r) => (
                            <SelectItem key={r.id} value={r.id} className="text-xs">
                              <span className="truncate max-w-sm block">
                                {r.category ? `[${r.category}] ` : ""}
                                {r.requirement.slice(0, 70)}...
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="task-desc" className="text-xs">
                        Description
                      </Label>
                      <Textarea
                        id="task-desc"
                        rows={3}
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                        placeholder="Specific instructions or deliverable format..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setNewTaskOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreatingTask}>
                      {isCreatingTask ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                      Create Task
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── Sub-page Navigation ────────────────────────────── */}
        <div className="flex border-b border-border gap-1 sm:gap-6 text-sm font-medium overflow-x-auto">
          <Link
            to="/tenders/$id"
            params={{ id: id || "" }}
            className="pb-3 px-1 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
          >
            <FileBarChart className="h-4 w-4" /> Intelligence Report
          </Link>
          <Link
            to="/tenders/$id/requirements"
            params={{ id: id || "" }}
            className="pb-3 px-1 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
          >
            <FileCheck className="h-4 w-4" /> Requirements Matrix
          </Link>
          <Link
            to="/tenders/$id/workspace"
            params={{ id: id || "" }}
            className="pb-3 px-1 border-b-2 border-accent text-foreground font-semibold flex items-center gap-2 whitespace-nowrap"
          >
            <Briefcase className="h-4 w-4 text-accent" /> Bid Command Center
          </Link>
        </div>

        {/* ── Command Center Sub-Tabs ──────────────────────── */}
        <div className="flex items-center gap-1 bg-secondary/60 p-1.5 rounded-xl border border-border/60 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all shrink-0 ${
              activeTab === "tasks"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
            }`}
          >
            <ListTodo className={`h-3.5 w-3.5 ${activeTab === "tasks" ? "text-white" : "text-primary"}`} />
            Tasks &amp; Readiness
          </button>
          <button
            onClick={() => setActiveTab("proposal")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all shrink-0 ${
              activeTab === "proposal"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
            }`}
          >
            <FileText className={`h-3.5 w-3.5 ${activeTab === "proposal" ? "text-white" : "text-primary"}`} />
            Proposal Workspace
          </button>
          <button
            onClick={() => setActiveTab("compliance")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all shrink-0 ${
              activeTab === "compliance"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
            }`}
          >
            <ShieldAlert className={`h-3.5 w-3.5 ${activeTab === "compliance" ? "text-white" : "text-primary"}`} />
            Compliance Auditor
          </button>
          <button
            onClick={() => setActiveTab("submission")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all shrink-0 ${
              activeTab === "submission"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
            }`}
          >
            <Send className={`h-3.5 w-3.5 ${activeTab === "submission" ? "text-white" : "text-primary"}`} />
            Submission Tracking
          </button>
          <button
            onClick={() => setActiveTab("outcomes")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all shrink-0 ${
              activeTab === "outcomes"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
            }`}
          >
            <Trophy className={`h-3.5 w-3.5 ${activeTab === "outcomes" ? "text-white" : "text-primary"}`} />
            Outcomes &amp; Debrief
          </button>
        </div>

        {activeTab === "tasks" && (
          <>
            {/* ── Operational Deadline Intelligence ─────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Deadline card */}
              <Card
                className={`border p-5 ${dl.urgencyLevel !== "none" ? ug.bg : "border-border/80 bg-card"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">
                    Submission Deadline
                  </span>
                  <Timer className={`h-4 w-4 ${ug.color}`} />
                </div>
                <p
                  className={`font-display font-bold text-lg ${dl.urgencyLevel !== "none" ? ug.color : "text-foreground"}`}
                >
                  {dl.deadline ? dl.deadline.toLocaleDateString() : "Not stated"}
                </p>
                <p className={`text-[11px] mt-0.5 font-mono ${ug.color}`}>
                  {dl.isOverdue
                    ? `Overdue by ${Math.abs(dl.daysRemaining ?? 0)} days`
                    : dl.daysRemaining !== null
                      ? `${dl.daysRemaining} day${dl.daysRemaining !== 1 ? "s" : ""} remaining`
                      : "No deadline specified"}
                </p>
              </Card>

              {/* Tasks progress */}
              <Card className="border border-border/80 bg-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">
                    Tasks Completed
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="font-display font-bold text-lg text-foreground">
                  {readinessReport.completedTaskCount} / {readinessReport.totalTaskCount}
                </p>
                <div className="w-full bg-secondary h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${readinessReport.totalTaskCount > 0 ? (readinessReport.completedTaskCount / readinessReport.totalTaskCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </Card>

              {/* Overdue tasks */}
              <Card
                className={`border p-5 ${dl.overdueTasks.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border/80 bg-card"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">
                    Overdue Tasks
                  </span>
                  <AlertCircle
                    className={`h-4 w-4 ${dl.overdueTasks.length > 0 ? "text-destructive" : "text-muted-foreground"}`}
                  />
                </div>
                <p
                  className={`font-display font-bold text-lg ${dl.overdueTasks.length > 0 ? "text-destructive" : "text-foreground"}`}
                >
                  {dl.overdueTasks.length}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {dl.tasksDueSoon.length > 0
                    ? `+${dl.tasksDueSoon.length} due within 48h`
                    : "No overdue tasks"}
                </p>
              </Card>

              {/* Contract Value */}
              <Card className="border border-border/80 bg-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">
                    Est. Contract Value
                  </span>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="font-display font-bold text-lg text-foreground font-mono">
                  {opportunity?.contract_value != null
                    ? `${opportunity.currency || "USD"} ${Number(opportunity.contract_value).toLocaleString()}`
                    : "Unspecified"}
                </p>
              </Card>
            </div>

            {/* ── Submission Readiness Score Card ───────────────── */}
            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-accent" />
                    <div>
                      <CardTitle className="font-display text-lg">Submission Readiness</CardTitle>
                      <CardDescription className="text-xs">
                        Deterministic readiness derived from application state only. AI does not
                        determine this score.
                      </CardDescription>
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${readinessStatusBorder(status)}`}
                  >
                    <span
                      className={`font-display font-extrabold text-xl ${readinessStatusColor(status)}`}
                    >
                      {score}
                    </span>
                    <span
                      className={`text-xs font-mono font-semibold uppercase ${readinessStatusColor(status)}`}
                    >
                      / 100 · {readinessStatusLabel(status)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Progress bar */}
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      score >= 85
                        ? "bg-emerald-500"
                        : score >= 65
                          ? "bg-blue-500"
                          : score >= 30
                            ? "bg-amber-500"
                            : "bg-destructive"
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: "Mandatory Requirements",
                      score: breakdown.mandatoryScore,
                      max: 40,
                      value: `${readinessReport.satisfiedMandatoryCount}/${readinessReport.mandatoryRequirementCount} met`,
                    },
                    {
                      label: "Tasks Completed",
                      score: breakdown.tasksScore,
                      max: 30,
                      value: `${readinessReport.completedTaskCount}/${readinessReport.totalTaskCount} done`,
                    },
                    {
                      label: "Proposal Sections",
                      score: breakdown.proposalsScore,
                      max: 15,
                      value: `${readinessReport.proposalCount} drafted`,
                    },
                    {
                      label: "No Active Blockers",
                      score: breakdown.noBlockersScore,
                      max: 15,
                      value: `${readinessReport.blockedTaskCount} blocked`,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-3 rounded-xl border border-border/60 bg-surface/40 space-y-1.5"
                    >
                      <p className="text-[10px] uppercase font-mono text-muted-foreground">
                        {item.label}
                      </p>
                      <div className="flex items-end justify-between">
                        <span className="font-display font-bold text-foreground">
                          {item.score}
                          <span className="text-[10px] text-muted-foreground font-normal">
                            /{item.max}
                          </span>
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Critical Evidence Gaps ─────────────────────────── */}
            {criticalGaps.length > 0 && (
              <Card className="border border-destructive/30 bg-destructive/5 shadow-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-base flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Critical Evidence Gaps ({criticalGaps.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Mandatory requirements with no confirmed evidence or completed task. Each gap
                    reduces your readiness score.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {criticalGaps.slice(0, 6).map((gap) => (
                    <div
                      key={gap.requirementId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-destructive/20 bg-background/60"
                    >
                      <div className="space-y-0.5 min-w-0">
                        {gap.category && (
                          <Badge variant="outline" className="text-[9px] font-mono mb-1">
                            {gap.category}
                          </Badge>
                        )}
                        <p className="text-xs text-foreground leading-snug line-clamp-2">
                          {gap.requirement}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Evidence status: {gap.evidenceStatus ?? "not assessed"} ·{" "}
                          {gap.linkedTaskId ? "task exists" : "no task linked"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => openTaskForGap(gap.requirementId, gap.requirement)}
                      >
                        <PlusCircle className="h-3 w-3 mr-1" /> Create Task
                      </Button>
                    </div>
                  ))}
                  {criticalGaps.length > 6 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{criticalGaps.length - 6} more gaps — view the{" "}
                      <Link
                        to="/tenders/$id/requirements"
                        params={{ id: id || "" }}
                        className="text-accent underline"
                      >
                        Requirements Matrix
                      </Link>{" "}
                      for full coverage.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Task Board ─────────────────────────────────────── */}
            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListTodo className="h-5 w-5 text-accent" />
                    <CardTitle className="font-display text-lg">Bid Deliverables & Tasks</CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {tasks.length} tasks
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {tasks.length === 0 ? (
                  <div className="text-center p-8 border border-dashed rounded-xl space-y-2">
                    <p className="text-xs text-muted-foreground font-mono">
                      No tasks added to this bid workspace yet.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setNewTaskOpen(true)}
                      className="text-xs"
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1" /> Add First Task
                    </Button>
                  </div>
                ) : viewMode === "kanban" ? (
                  /* ─── Kanban Board ─── */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {KANBAN_COLUMNS.map((col) => {
                      const colTasks = tasks.filter((t) => t.status === col.key);
                      return (
                        <div key={col.key} className="space-y-2">
                          <div className="flex items-center justify-between pb-2 border-b border-border/40">
                            <span
                              className={`text-xs font-semibold font-mono uppercase ${col.color}`}
                            >
                              {col.label}
                            </span>
                            <Badge variant="secondary" className="text-[10px] font-mono">
                              {colTasks.length}
                            </Badge>
                          </div>
                          {colTasks.length === 0 ? (
                            <div className="p-4 rounded-xl border border-dashed text-center text-[11px] text-muted-foreground">
                              Empty
                            </div>
                          ) : (
                            colTasks.map((t) => {
                              const linkedReq = requirements.find((r) => r.id === t.requirement_id);
                              return (
                                <div
                                  key={t.id}
                                  className="p-3 rounded-xl border border-border/60 bg-surface/50 space-y-2"
                                >
                                  <div className="flex flex-wrap gap-1.5">
                                    <PriorityBadge priority={t.priority} />
                                    {t.due_date &&
                                      new Date(t.due_date) < new Date() &&
                                      t.status !== "completed" && (
                                        <Badge
                                          variant="destructive"
                                          className="text-[9px] font-mono"
                                        >
                                          OVERDUE
                                        </Badge>
                                      )}
                                  </div>
                                  <p className="text-xs font-semibold text-foreground leading-snug">
                                    {t.title}
                                  </p>
                                  {linkedReq && (
                                    <p className="text-[10px] text-accent font-mono flex items-center gap-1">
                                      <FileCheck className="h-3 w-3" />
                                      {linkedReq.requirement.slice(0, 40)}...
                                    </p>
                                  )}
                                  {t.due_date && (
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(t.due_date).toLocaleDateString()}
                                    </p>
                                  )}
                                  <Select
                                    value={t.status}
                                    onValueChange={(val) =>
                                      handleUpdateTaskStatus(
                                        t.id,
                                        val as "todo" | "in_progress" | "blocked" | "completed",
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="todo">To Do</SelectItem>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="blocked">Blocked</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ─── List View ─── */
                  <div className="space-y-2">
                    {tasks.map((t) => {
                      const linkedReq = requirements.find((r) => r.id === t.requirement_id);
                      const isOverdueTask =
                        t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed";

                      return (
                        <div
                          key={t.id}
                          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                            t.status === "completed"
                              ? "bg-surface/30 border-border/40 opacity-75"
                              : t.status === "blocked"
                                ? "bg-destructive/5 border-destructive/30"
                                : "bg-surface/50 border-border/80"
                          }`}
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <PriorityBadge priority={t.priority} />
                              <StatusBadge status={t.status} />
                              {isOverdueTask && (
                                <Badge variant="destructive" className="text-[9px] font-mono">
                                  OVERDUE
                                </Badge>
                              )}
                              <span
                                className={`font-semibold text-sm ${
                                  t.status === "completed"
                                    ? "line-through text-muted-foreground"
                                    : "text-foreground"
                                }`}
                              >
                                {t.title}
                              </span>
                            </div>

                            {t.description && (
                              <p className="text-xs text-muted-foreground">{t.description}</p>
                            )}

                            {linkedReq && (
                              <p className="text-[11px] text-accent flex items-center gap-1 font-mono">
                                <FileCheck className="h-3 w-3" /> Linked:{" "}
                                {linkedReq.requirement.slice(0, 60)}...
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {t.due_date && (
                              <span
                                className={`text-xs font-mono flex items-center gap-1 ${
                                  isOverdueTask ? "text-destructive" : "text-muted-foreground"
                                }`}
                              >
                                <Calendar className="h-3.5 w-3.5" />
                                {new Date(t.due_date).toLocaleDateString()}
                              </span>
                            )}

                            <Select
                              value={t.status}
                              onValueChange={(val) =>
                                handleUpdateTaskStatus(
                                  t.id,
                                  val as "todo" | "in_progress" | "blocked" | "completed",
                                )
                              }
                            >
                              <SelectTrigger className="h-8 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="blocked">Blocked</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteTask(t.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Proposals & Notes ──────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Workspace Notes */}
              <Card className="border border-border/80 shadow-panel bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display text-base">
                      Strategy & Pursuit Notes
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="h-7 text-xs gap-1"
                    >
                      {isSavingNotes ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Save
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Textarea
                    rows={7}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Record win themes, competitor intelligence, executive sponsor commitments, and proposal team assignments..."
                    className="text-xs font-mono leading-relaxed"
                  />
                </CardContent>
              </Card>

              {/* Proposal Documents */}
              <Card className="border border-border/80 shadow-panel bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-display text-base">Proposal Preparation</CardTitle>
                      <CardDescription className="text-xs">
                        Draft sections & structured response deliverables.
                      </CardDescription>
                    </div>
                    <Dialog open={newDocOpen} onOpenChange={setNewDocOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <PlusCircle className="h-3 w-3 mr-1" /> New Section
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <form onSubmit={handleCreateDocument}>
                          <DialogHeader>
                            <DialogTitle className="font-display text-lg">
                              Add Proposal Section
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                              Draft a structured response section aligned to tender requirements.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 py-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Section Title</Label>
                              <Input
                                required
                                value={docTitle}
                                onChange={(e) => setDocTitle(e.target.value)}
                                placeholder="e.g. Executive Summary & Value Proposition"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Draft Content</Label>
                              <Textarea
                                rows={6}
                                value={docContent}
                                onChange={(e) => setDocContent(e.target.value)}
                                placeholder="Enter section draft..."
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              type="button"
                              onClick={() => setNewDocOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={isCreatingDoc}>
                              Save Draft
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {proposals.length === 0 ? (
                    <div className="p-6 text-center border border-dashed rounded-xl space-y-2">
                      <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">
                        No proposal sections drafted yet. Each section drafted contributes to your
                        readiness score.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => setNewDocOpen(true)}
                      >
                        <PlusCircle className="h-3.5 w-3.5 mr-1" /> Start Drafting
                      </Button>
                    </div>
                  ) : (
                    proposals.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 rounded-lg border border-border/60 bg-surface/40 text-xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-accent shrink-0" />
                          <span className="font-semibold text-foreground truncate">
                            {doc.title}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                            v{doc.version}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {activeTab === "proposal" && (
          <ProposalWorkspaceTab
            opportunityId={id || ""}
            workspaceId={workspace?.id || ""}
            opportunityTitle={opportunity?.title}
          />
        )}

        {activeTab === "compliance" && (
          <ComplianceAuditTab opportunityId={id || ""} workspaceId={workspace?.id || ""} />
        )}

        {activeTab === "submission" && (
          <SubmissionTrackingTab
            opportunityId={id || ""}
            workspaceId={workspace?.id || ""}
            contractCurrency={opportunity?.currency ?? null}
            contractValue={opportunity?.contract_value ?? null}
          />
        )}

        {activeTab === "outcomes" && (
          <OutcomesLearningTab
            opportunityId={id || ""}
            workspaceId={workspace?.id || ""}
            contractCurrency={opportunity?.currency ?? null}
            contractValue={opportunity?.contract_value ?? null}
          />
        )}
      </div>
    </AppShell>
  );
}
