import React, { useState, useEffect, useCallback } from "react";
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
  Edit3,
  FileText,
  Building2,
  ListTodo,
  FileBarChart,
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
type BidWorkspace = Database["public"]["Tables"]["bid_workspaces"]["Row"];
type BidTask = Database["public"]["Tables"]["bid_tasks"]["Row"];
type OpportunityRequirement = Database["public"]["Tables"]["opportunity_requirements"]["Row"];
type ProposalDocument = Database["public"]["Tables"]["proposal_documents"]["Row"];

export const Route = createFileRoute("/tenders/$id/workspace")({
  component: BidWorkspacePage,
});

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

function BidWorkspacePage() {
  const { id } = useParams({ from: "/tenders/$id/workspace" });
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [bidWorkspace, setBidWorkspace] = useState<BidWorkspace | null>(null);
  const [tasks, setTasks] = useState<BidTask[]>([]);
  const [requirements, setRequirements] = useState<OpportunityRequirement[]>([]);
  const [proposals, setProposals] = useState<ProposalDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const loadWorkspaceData = useCallback(async () => {
    if (!id || !workspace) return;
    setIsLoading(true);
    try {
      // 1. Load Opportunity
      const { data: opp } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      setOpportunity(opp);

      // 2. Load or Initialize Bid Workspace
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
        // 3. Load Tasks
        const { data: taskRows } = await supabase
          .from("bid_tasks")
          .select("*")
          .eq("bid_workspace_id", bw.id)
          .order("created_at", { ascending: false });
        setTasks(taskRows ?? []);

        // 4. Load Proposal Documents
        const { data: docRows } = await supabase
          .from("proposal_documents")
          .select("*")
          .eq("bid_workspace_id", bw.id)
          .order("created_at", { ascending: false });
        setProposals(docRows ?? []);
      }

      // 5. Load Requirements for task association
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

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !bidWorkspace || !workspace || !user) return;

    setIsCreatingTask(true);
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
        requirement_id: taskRequirementId === "none" ? null : taskRequirementId,
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
      toast.success(`Task status updated: ${newStatus}`);
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

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppShell>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const progressPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              <span className="text-foreground shrink-0">Bid Workspace</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <span>Bid Management Workspace</span>
              <Badge variant="outline" className="font-mono text-xs text-accent border-accent">
                {opportunity?.status.toUpperCase()}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Coordinate submission deliverables, requirement assignments, deadlines, and proposal
              preparation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground">
                  <PlusCircle className="h-4 w-4 mr-1.5" /> Add Bid Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreateTask}>
                  <DialogHeader>
                    <DialogTitle className="font-display text-lg">
                      Add Bid Workspace Task
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Assign a deliverable, requirement compliance verification, or pricing
                      activity.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-3 text-xs">
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
                      <Label className="text-xs">Link to Extracted RFP Requirement</Label>
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
            className="pb-3 text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <FileCheck className="h-4 w-4" /> Requirements Matrix
          </Link>
          <Link
            to="/tenders/$id/workspace"
            params={{ id: id || "" }}
            className="pb-3 border-b-2 border-accent text-foreground font-semibold flex items-center gap-2"
          >
            <Briefcase className="h-4 w-4 text-accent" /> Bid Workspace & Tasks ({tasks.length})
          </Link>
        </div>

        {/* Top Progress & Details Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-border/80 bg-card p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-mono uppercase">Deliverables Completed</span>
              <span className="font-mono font-bold text-foreground">
                {completedTasks} / {tasks.length} ({progressPct}%)
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden mt-2">
              <div
                className="bg-accent h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </Card>

          <Card className="border border-border/80 bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase text-muted-foreground">
                  Submission Deadline
                </p>
                <p className="font-display font-bold text-lg text-foreground mt-0.5">
                  {opportunity?.deadline
                    ? new Date(opportunity.deadline).toLocaleDateString()
                    : "Not stated"}
                </p>
              </div>
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
          </Card>

          <Card className="border border-border/80 bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase text-muted-foreground">
                  Est. Contract Value
                </p>
                <p className="font-display font-bold text-lg text-foreground mt-0.5 font-mono">
                  {opportunity?.contract_value != null
                    ? `${opportunity.currency || "USD"} ${Number(opportunity.contract_value).toLocaleString()}`
                    : "Unspecified"}
                </p>
              </div>
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
          </Card>
        </div>

        {/* Task Board / List */}
        <Card className="border border-border/80 shadow-panel bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-accent" />
                <CardTitle className="font-display text-lg">Bid Deliverables & Tasks</CardTitle>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {tasks.length} active tasks
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
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
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => {
                  const linkedReq = requirements.find((r) => r.id === t.requirement_id);

                  return (
                    <div
                      key={t.id}
                      className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                        t.status === "completed"
                          ? "bg-surface/30 border-border/40 opacity-75"
                          : "bg-surface/50 border-border/80"
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <PriorityBadge priority={t.priority} />
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
                            <FileCheck className="h-3 w-3" /> Linked to clause:{" "}
                            {linkedReq.requirement.slice(0, 60)}...
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {t.due_date && (
                          <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
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

        {/* Proposals & Strategy Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Workspace Notes */}
          <Card className="border border-border/80 shadow-panel bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-base">Strategy & Pursuit Notes</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="h-7 text-xs"
                >
                  {isSavingNotes ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Save
                  Notes
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Textarea
                rows={6}
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
                    Draft sections & deliverables.
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
                      </DialogHeader>
                      <div className="space-y-3 py-3 text-xs">
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
                <p className="text-xs text-muted-foreground italic py-4 text-center">
                  No proposal drafts created yet.
                </p>
              ) : (
                proposals.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-lg border border-border/60 bg-surface/40 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-accent" />
                      <span className="font-semibold text-foreground">{doc.title}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        v{doc.version}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
