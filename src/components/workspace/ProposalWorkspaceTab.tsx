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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Sparkles,
  Download,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Copy,
  Eye,
  Edit3,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listProposalSectionsFn,
  draftProposalSectionFn,
  saveProposalSectionFn,
  exportProposalFn,
  getProposalCompletenessFn,
  deleteProposalSectionFn,
} from "@/lib/proposal/proposal.functions";
import {
  PROPOSAL_SECTION_TYPES,
  REQUIRED_PROPOSAL_SECTION_TYPES,
  type ProposalDocRecord,
  type ProposalSectionType,
  type ProposalCompletenessResult,
} from "@/lib/proposal/proposal.types";

interface ProposalWorkspaceTabProps {
  opportunityId: string;
  workspaceId: string;
  opportunityTitle?: string | undefined;
}

function ProposalWorkspaceTabComponent({
  opportunityId,
  workspaceId,
  opportunityTitle,
}: ProposalWorkspaceTabProps) {
  const [sections, setSections] = useState<ProposalDocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [completeness, setCompleteness] = useState<ProposalCompletenessResult | null>(null);

  // Active section for editing
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState("");
  const [activeContent, setActiveContent] = useState("");
  const [activeType, setActiveType] = useState<string>("technical_approach");
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<ProposalDocRecord | null>(null);
  const [isDeletingSection, setIsDeletingSection] = useState(false);

  // AI Generation Dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiSectionType, setAiSectionType] = useState<ProposalSectionType>("technical_approach");
  const [aiSectionTitle, setAiSectionTitle] = useState("Technical Approach & Methodology");
  const [aiPromptGuidance, setAiPromptGuidance] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // New Section Dialog
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ProposalSectionType>("executive_summary");
  const [newContent, setNewContent] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [secList, comp] = await Promise.all([
        listProposalSectionsFn({ data: { opportunityId, workspaceId } }),
        getProposalCompletenessFn({ data: { opportunityId, workspaceId } }),
      ]);
      setSections(secList);
      setCompleteness(comp);

      // Default select first section if available
      if (secList.length > 0 && !activeSectionId) {
        const first = secList[0]!;
        setActiveSectionId(first.id);
        setActiveTitle(first.title);
        setActiveContent(first.content || "");
        setActiveType(first.section_type || "technical_approach");
      }
    } catch (err) {
      console.error("[Proposal] Load error:", err);
      toast.error("Failed to load proposal sections");
    } finally {
      setLoading(false);
    }
  }, [opportunityId, workspaceId, activeSectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectSection = (sec: ProposalDocRecord) => {
    setActiveSectionId(sec.id);
    setActiveTitle(sec.title);
    setActiveContent(sec.content || "");
    setActiveType(sec.section_type || "technical_approach");
    setPreviewMode(false);
  };

  const handleSaveActive = async () => {
    if (!activeTitle.trim()) {
      toast.error("Section title cannot be empty");
      return;
    }
    setIsSaving(true);
    try {
      const res = await saveProposalSectionFn({
        data: {
          opportunityId,
          workspaceId,
          ...(activeSectionId ? { id: activeSectionId } : {}),
          title: activeTitle.trim(),
          content: activeContent,
          section_type: activeType,
        },
      });
      toast.success(`Section saved (v${res.version})`);
      await loadData();
    } catch (err) {
      toast.error("Failed to save section", { description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await saveProposalSectionFn({
        data: {
          opportunityId,
          workspaceId,
          title: newTitle.trim(),
          content: newContent,
          section_type: newType,
        },
      });
      toast.success("New proposal section created");
      setNewSectionOpen(false);
      setNewTitle("");
      setNewContent("");
      await loadData();
    } catch (err) {
      toast.error("Failed to create section", { description: (err as Error).message });
    }
  };

  const handleGenerateAi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      toast.info("Generating grounded proposal draft from company evidence...");
      const res = await draftProposalSectionFn({
        data: {
          opportunityId,
          workspaceId,
          sectionType: aiSectionType,
          sectionTitle: aiSectionTitle,
          ...(aiPromptGuidance ? { additionalContext: aiPromptGuidance } : {}),
        },
      });

      // Save as a new section
      const saved = await saveProposalSectionFn({
        data: {
          opportunityId,
          workspaceId,
          title: aiSectionTitle,
          content: res.content,
          section_type: aiSectionType,
        },
      });

      toast.success("AI draft generated and saved to proposal");
      if (res.evidenceGaps.length > 0) {
        toast.warning(
          `${res.evidenceGaps.length} evidence gap${res.evidenceGaps.length > 1 ? "s" : ""} flagged inline for manual review.`,
        );
      }
      setAiDialogOpen(false);
      setAiPromptGuidance("");
      await loadData();
      setActiveSectionId(saved.id);
      setActiveTitle(aiSectionTitle);
      setActiveContent(res.content);
      setActiveType(aiSectionType);
    } catch (err) {
      toast.error("AI Generation failed", { description: (err as Error).message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    try {
      toast.info("Compiling full proposal document...");
      const res = await exportProposalFn({ data: { opportunityId, workspaceId } });

      // Create blob download
      const blob = new Blob([res.markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${res.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Proposal exported as Markdown document");
    } catch (err) {
      toast.error("Export failed", { description: (err as Error).message });
    }
  };

  const handleCopyToClipboard = () => {
    if (!activeContent) return;
    navigator.clipboard.writeText(activeContent);
    toast.success("Section copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  const activeSection = sections.find((s) => s.id === activeSectionId);

  return (
    <div className="space-y-6">
      {/* ── Proposal Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            Proposal Workspace
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Grounded response builder with inline evidence verification and full document export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* AI Generate Button */}
          <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-xs gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" /> AI Draft Section
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={handleGenerateAi}>
                <DialogHeader>
                  <DialogTitle className="font-display text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-accent" /> AI Proposal Section Writer
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Drafts tender responses strictly grounded in your company profile and uploaded
                    evidence. Missing evidence is flagged inline.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3.5 py-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-xs">Section Type</Label>
                    <Select
                      value={aiSectionType}
                      onValueChange={(v) => {
                        const t = v as ProposalSectionType;
                        setAiSectionType(t);
                        setAiSectionTitle(
                          t
                            .split("_")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" "),
                        );
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {PROPOSAL_SECTION_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize text-xs">
                            {t.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Section Title</Label>
                    <Input
                      required
                      value={aiSectionTitle}
                      onChange={(e) => setAiSectionTitle(e.target.value)}
                      className="h-9 text-xs"
                      placeholder="e.g. Technical Approach & Solution Architecture"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Additional Context or Strategy Guidance</Label>
                    <Textarea
                      rows={4}
                      value={aiPromptGuidance}
                      onChange={(e) => setAiPromptGuidance(e.target.value)}
                      placeholder="e.g. Emphasize our local team in Lilongwe, 99.9% uptime SLA, and ISO 27001 data sovereignty compliance..."
                      className="text-xs"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setAiDialogOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isGenerating} className="text-xs">
                    {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    Generate Draft
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* New Section Manual */}
          <Dialog open={newSectionOpen} onOpenChange={setNewSectionOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-xs gap-1.5">
                <PlusCircle className="h-3.5 w-3.5" /> New Section
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleCreateManual}>
                <DialogHeader>
                  <DialogTitle className="font-display text-lg">Add Proposal Section</DialogTitle>
                  <DialogDescription className="text-xs">
                    Create a blank section to author manually.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-xs">Section Type</Label>
                    <Select
                      value={newType}
                      onValueChange={(v) => setNewType(v as ProposalSectionType)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {PROPOSAL_SECTION_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize text-xs">
                            {t.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Section title..."
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setNewSectionOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="text-xs">
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Export Full Proposal Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={sections.length === 0}
            className="text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export Markdown
          </Button>
        </div>
      </div>

      {/* ── Completeness Banner ── */}
      {completeness && (
        <Card className="border border-border/80 bg-card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-foreground">
                  Proposal Completeness
                </span>
                <Badge
                  variant="outline"
                  className={`font-mono text-[10px] ${
                    completeness.score === 100
                      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                      : completeness.score >= 50
                        ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                        : "border-destructive/40 text-destructive bg-destructive/10"
                  }`}
                >
                  {completeness.score}% READY
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {completeness.completed} of {completeness.total} required response sections fully
                completed.
                {completeness.hasEvidenceGaps && (
                  <span className="text-amber-600 dark:text-amber-400 ml-1 font-medium">
                    Evidence gaps remain to be verified.
                  </span>
                )}
              </p>
            </div>

            <div className="w-full sm:w-48 bg-secondary rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  completeness.score === 100
                    ? "bg-emerald-500"
                    : completeness.score >= 50
                      ? "bg-amber-500"
                      : "bg-destructive"
                }`}
                style={{ width: `${completeness.score}%` }}
              />
            </div>
          </div>

          {/* Core Required Section Indicators */}
          <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground uppercase">
              Required Sections:
            </span>
            {REQUIRED_PROPOSAL_SECTION_TYPES.map((reqType) => {
              const status = completeness.requiredSectionsStatus?.[reqType] || "missing";
              const label = reqType.replace(/_/g, " ");
              return (
                <span
                  key={reqType}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono capitalize border ${
                    status === "complete"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                      : status === "in_progress"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                        : "bg-surface-muted text-muted-foreground border-border/60"
                  }`}
                >
                  {status === "complete" ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : status === "in_progress" ? (
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  )}
                  {label} ({status.replace(/_/g, " ")})
                </span>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Main Proposal Split View (Sections List | Editor) ── */}
      {sections.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-xl space-y-3 bg-surface/20">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <p className="font-display text-base font-semibold text-foreground">
              No proposal sections drafted yet
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Start by clicking &quot;AI Draft Section&quot; to synthesize your company profile and
              evidence into tailored response sections, or author manually.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => setAiDialogOpen(true)}
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" /> AI Draft Section
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNewSectionOpen(true)}
              className="text-xs"
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1" /> New Manual Section
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar Section List */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-mono uppercase text-muted-foreground">
                Sections ({sections.length})
              </span>
            </div>
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {sections.map((s) => {
                const isSelected = s.id === activeSectionId;
                const hasGaps = s.content?.includes("[Evidence required:");
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSection(s)}
                    className={`w-full text-left p-3 rounded-xl border transition-all space-y-1.5 ${
                      isSelected
                        ? "border-accent bg-accent/10 shadow-sm"
                        : "border-border/60 bg-surface/40 hover:bg-surface/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {s.title}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        v{s.version}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground capitalize">
                        {s.section_type?.replace(/_/g, " ") || "Custom"}
                      </span>
                      {hasGaps ? (
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0"
                        >
                          Evidence Gap
                        </Badge>
                      ) : s.completeness_status === "complete" ? (
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0"
                        >
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">
                          Draft
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Editor / Preview */}
          <div className="lg:col-span-8">
            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <Input
                      value={activeTitle}
                      onChange={(e) => setActiveTitle(e.target.value)}
                      className="font-display font-bold text-base bg-transparent border-transparent hover:border-border/60 focus:border-accent p-0 h-auto"
                      placeholder="Section Title"
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <span>Type: {activeType.replace(/_/g, " ")}</span>
                      {activeSection && <span>· Version {activeSection.version}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewMode(!previewMode)}
                      className="h-8 text-xs gap-1"
                    >
                      {previewMode ? (
                        <>
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyToClipboard}
                      className="h-8 text-xs gap-1"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                    {activeSection && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteSectionTarget(activeSection)}
                        className="h-8 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete Section"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSaveActive}
                      disabled={isSaving}
                      className="bg-accent text-accent-foreground hover:bg-accent/90 h-8 text-xs gap-1 font-semibold"
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save Draft
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                {previewMode ? (
                  <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed space-y-3 min-h-[350px] p-2 bg-surface/20 rounded-lg">
                    {activeContent ? (
                      activeContent.split("\n\n").map((para, i) => {
                        if (para.startsWith("### ")) {
                          return (
                            <h3 key={i} className="text-sm font-bold text-foreground">
                              {para.replace("### ", "")}
                            </h3>
                          );
                        }
                        if (para.startsWith("## ")) {
                          return (
                            <h2 key={i} className="text-base font-bold text-foreground">
                              {para.replace("## ", "")}
                            </h2>
                          );
                        }
                        if (para.includes("[Evidence required:")) {
                          return (
                            <p
                              key={i}
                              className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono text-xs"
                            >
                              {para}
                            </p>
                          );
                        }
                        return (
                          <p key={i} className="text-muted-foreground whitespace-pre-line">
                            {para}
                          </p>
                        );
                      })
                    ) : (
                      <p className="text-muted-foreground italic">No content in this section.</p>
                    )}
                  </div>
                ) : (
                  <Textarea
                    rows={16}
                    value={activeContent}
                    onChange={(e) => setActiveContent(e.target.value)}
                    placeholder="Enter proposal response text in Markdown format..."
                    className="font-mono text-xs leading-relaxed resize-y min-h-[350px]"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Delete Section Dialog */}
      <AlertDialog
        open={Boolean(deleteSectionTarget)}
        onOpenChange={(open) => !open && setDeleteSectionTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal Section?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteSectionTarget?.title}&quot;? This action
              cannot be undone and will immediately recalculate proposal completeness.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSection}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteSectionTarget) return;
                setIsDeletingSection(true);
                try {
                  await deleteProposalSectionFn({
                    data: { sectionId: deleteSectionTarget.id, workspaceId },
                  });
                  toast.success("Section removed from proposal");
                  if (activeSectionId === deleteSectionTarget.id) {
                    setActiveSectionId(null);
                    setActiveTitle("");
                    setActiveContent("");
                  }
                  setDeleteSectionTarget(null);
                  await loadData();
                } catch (err) {
                  toast.error("Failed to delete section", {
                    description: (err as Error).message,
                  });
                } finally {
                  setIsDeletingSection(false);
                }
              }}
              disabled={isDeletingSection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSection ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Delete Section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const ProposalWorkspaceTab = ProposalWorkspaceTabComponent;
