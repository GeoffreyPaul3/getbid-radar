import React, { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  BookOpen,
  Upload,
  Search,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2,
  PlusCircle,
  MoreHorizontal,
  Eye,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  FileCode,
  FileSpreadsheet,
} from "lucide-react";
import { processKnowledgeDocumentFn } from "@/lib/knowledge.functions";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type KnowledgeDocument = Database["public"]["Tables"]["knowledge_documents"]["Row"];

const PAGE_SIZE = 10;

const CATEGORY_TABS = [
  { id: "all", label: "All Evidence" },
  { id: "certification", label: "Certifications" },
  { id: "case_study", label: "Past Performance" },
  { id: "financial_statement", label: "Financials" },
  { id: "technical_specification", label: "Technical Specs" },
  { id: "reference_letter", label: "References" },
  { id: "policy", label: "Policies" },
] as const;

function formatFileType(mimeType?: string | null, storagePath?: string) {
  if (mimeType?.includes("pdf")) return "PDF";
  if (mimeType?.includes("word") || mimeType?.includes("docx") || mimeType?.includes("document"))
    return "DOCX";
  if (
    mimeType?.includes("excel") ||
    mimeType?.includes("spreadsheet") ||
    mimeType?.includes("xlsx")
  )
    return "XLSX";
  if (mimeType?.includes("text")) return "TXT";
  if (storagePath) {
    const ext = storagePath.split(".").pop()?.toUpperCase();
    if (ext && ext.length <= 4) return ext;
  }
  return "DOC";
}

function formatSourceFileName(storagePath?: string) {
  if (!storagePath) return "Direct Upload";
  const name = storagePath.split("/").pop() || "Document";
  return name.replace(/^[^_]+_/, "");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-medium">
        <CheckCircle2 className="h-3 w-3" /> VERIFIED
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/20 text-[10px] font-mono font-medium animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" /> INDEXING
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 text-[10px] font-mono font-medium">
        <AlertCircle className="h-3 w-3" /> FAILED
      </span>
    );
  }
  return (
    <Badge variant="outline" className="font-mono text-[10px] uppercase">
      {status}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, { label: string; className: string }> = {
    certification: {
      label: "Certification",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    case_study: {
      label: "Past Performance",
      className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    financial_statement: {
      label: "Financial Audit",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    technical_specification: {
      label: "Technical Spec",
      className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    },
    reference_letter: {
      label: "Reference Letter",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    policy: {
      label: "Corporate Policy",
      className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    },
  };

  const info = map[category] || {
    label: category.replace(/_/g, " "),
    className: "bg-surface-muted text-muted-foreground border-border",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-medium border ${info.className}`}
    >
      {info.label}
    </span>
  );
}

import { useRequireAuth } from "@/lib/use-require-auth";

export const Route = createFileRoute("/knowledge")({
  component: KnowledgeBasePage,
});

function KnowledgeBasePage() {
  const { isReady, AuthLoadingFallback, workspace } = useRequireAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Upload Dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("certification");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // View Details Dialog
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocument | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!workspace) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data ?? []);
    } catch (err) {
      console.error("[Knowledge] Load error:", err);
      toast.error("Failed to load evidence library");
    } finally {
      setIsLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Reset pagination on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeCategory]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !workspace) {
      toast.error("Please select a file to upload");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("Uploading and extracting evidence document...");

    try {
      const tempId = crypto.randomUUID();
      const sanitizedName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${workspace.id}/knowledge/${tempId}/${sanitizedName}`;

      const { error: storageErr } = await supabase.storage
        .from("documents")
        .upload(storagePath, uploadFile, {
          upsert: true,
          contentType: uploadFile.type || "application/octet-stream",
        });

      if (storageErr) throw new Error(`Storage upload error: ${storageErr.message}`);

      toast.loading("Parsing text content and indexing for AI matching...", { id: toastId });

      await processKnowledgeDocumentFn({
        data: {
          workspaceId: workspace.id,
          storagePath,
          fileName: uploadFile.name,
          fileSize: uploadFile.size,
          mimeType: uploadFile.type || "application/pdf",
          title: uploadTitle.trim() || uploadFile.name.replace(/\.[^/.]+$/, ""),
          category: uploadCategory,
        },
      });

      toast.success("Document added to corporate evidence base!", { id: toastId });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadTitle("");
      await loadDocuments();
    } catch (err) {
      toast.error("Upload failed", { id: toastId, description: (err as Error).message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !workspace) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.storage_path) {
        await supabase.storage.from("documents").remove([deleteTarget.storage_path]);
      }
      const { error } = await supabase
        .from("knowledge_documents")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("workspace_id", workspace.id);

      if (error) throw error;
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.title}" removed from evidence base`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error("Failed to delete evidence", { description: (err as Error).message });
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = documents.filter((doc) => {
    const matchesSearch =
      !searchQuery.trim() ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.category && doc.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.extracted_text && doc.extracted_text.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat = activeCategory === "all" || doc.category === activeCategory;

    return matchesSearch && matchesCat;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (!isReady) return AuthLoadingFallback;

  return (
    <AppShell>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-primary">
                Corporate Intelligence
              </span>
              <span className="text-border-strong">•</span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {filtered.length} of {documents.length} Evidence Records
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Corporate Evidence Base
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
              Maintain verified certifications, past performance records, and technical whitepapers
              used to substantiate RFP qualification.
            </p>
          </div>

          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary-bright shadow-subtle h-9 text-xs">
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Upload Evidence Document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleUploadSubmit}>
                <DialogHeader>
                  <DialogTitle className="font-display text-lg">Add Evidence Document</DialogTitle>
                  <DialogDescription className="text-xs">
                    Upload corporate certificates, past performance records, or technical
                    specifications.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-xs">Document Title</Label>
                    <Input
                      required
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="e.g. ISO 9001:2015 Quality Management Certificate"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Evidence Category</Label>
                    <Select value={uploadCategory} onValueChange={setUploadCategory}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="certification" className="text-xs">
                          Certification &amp; Accreditations
                        </SelectItem>
                        <SelectItem value="case_study" className="text-xs">
                          Case Study / Past Performance
                        </SelectItem>
                        <SelectItem value="financial_statement" className="text-xs">
                          Financial Statements &amp; Audits
                        </SelectItem>
                        <SelectItem value="technical_specification" className="text-xs">
                          Technical Capabilities / Whitepaper
                        </SelectItem>
                        <SelectItem value="reference_letter" className="text-xs">
                          Client Reference Letter
                        </SelectItem>
                        <SelectItem value="policy" className="text-xs">
                          Corporate Policy / Compliance
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:bg-surface-muted/50 transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.xlsx,.txt"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const f = e.target.files[0];
                          setUploadFile(f);
                          if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ""));
                        }
                      }}
                    />
                    {uploadFile ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground text-xs">{uploadFile.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="h-5 w-5 text-primary mx-auto mb-1" />
                        <p className="font-medium text-xs">Click to select PDF, DOCX, or XLSX</p>
                        <p className="text-[10px] text-muted-foreground">Up to 25MB</p>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setUploadOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!uploadFile || isUploading}
                    className="bg-primary text-white hover:bg-primary-bright text-xs"
                  >
                    {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    Upload &amp; Index
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-surface border border-border">
            {CATEGORY_TABS.map((tab) => {
              const count =
                tab.id === "all"
                  ? documents.length
                  : documents.filter((d) => d.category === tab.id).length;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeCategory === tab.id
                      ? "bg-primary text-white shadow-subtle font-semibold"
                      : "text-text-secondary hover:text-foreground hover:bg-surface-muted"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      activeCategory === tab.id
                        ? "bg-white/20 text-white"
                        : "bg-surface-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search title, category, text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 h-9 text-xs rounded-lg border-border bg-surface"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-xl border border-border">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-xs text-muted-foreground font-mono">
              Loading corporate evidence base...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground mx-auto">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-foreground">
                {searchQuery || activeCategory !== "all"
                  ? "No Matching Evidence Found"
                  : "No Corporate Evidence Uploaded Yet"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery || activeCategory !== "all"
                  ? "Try resetting your search query or switching the category filter."
                  : "Upload company capability statements, certifications, and project references so the requirement matching engine can verify RFP compliance."}
              </p>
            </div>
            <Button
              onClick={() => setUploadOpen(true)}
              size="sm"
              className="bg-primary text-white hover:bg-primary-bright"
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Upload First Evidence Document
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface shadow-subtle overflow-hidden">
            <Table className="min-w-[750px] w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%] min-w-[240px]">Evidence / Document</TableHead>
                  <TableHead className="w-[10%] min-w-[80px]">Type</TableHead>
                  <TableHead className="w-[18%] min-w-[130px]">Category</TableHead>
                  <TableHead className="w-[15%] min-w-[120px]">Source File</TableHead>
                  <TableHead className="w-[11%] min-w-[100px]">Status</TableHead>
                  <TableHead className="w-[11%] min-w-[90px]">Updated</TableHead>
                  <TableHead className="w-[6%] min-w-[50px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((doc) => {
                  const fileType = formatFileType(doc.mime_type, doc.storage_path);
                  const sourceName = formatSourceFileName(doc.storage_path);
                  const fileSizeMb = doc.file_size
                    ? (doc.file_size / (1024 * 1024)).toFixed(1)
                    : null;

                  return (
                    <TableRow key={doc.id} className="hover:bg-surface-muted/40 transition-colors">
                      <TableCell className="py-3 max-w-[280px]">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="font-display font-bold text-sm text-foreground hover:text-primary transition-colors text-left line-clamp-2 break-words leading-snug"
                        >
                          {doc.title}
                        </button>
                        {doc.extracted_text && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {doc.extracted_text.slice(0, 120)}...
                          </p>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        <span className="font-mono text-[10px] font-bold uppercase bg-surface-muted text-muted-foreground px-2 py-0.5 rounded border border-border/60">
                          {fileType}
                        </span>
                      </TableCell>

                      <TableCell className="py-3">
                        <CategoryBadge category={doc.category} />
                      </TableCell>

                      <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                        <span className="truncate block max-w-[140px]" title={sourceName}>
                          {sourceName}
                        </span>
                        {fileSizeMb && (
                          <span className="text-[10px] text-muted-foreground/70">
                            {fileSizeMb} MB
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        <StatusBadge status={doc.status} />
                      </TableCell>

                      <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                        <div className="flex items-center gap-1 text-foreground">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {new Date(doc.updated_at || doc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              aria-label="Evidence actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              className="flex items-center gap-2 cursor-pointer text-xs"
                              onClick={() => setPreviewDoc(doc)}
                            >
                              <Eye className="h-3.5 w-3.5 text-primary" />
                              <span>View Details</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer text-xs"
                              onClick={() => setDeleteTarget(doc)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete Evidence</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface">
                <span className="text-xs text-muted-foreground font-mono">
                  Page {currentPage} of {totalPages} &middot; {filtered.length} results
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "..." ? (
                        <span key={`ellipsis-${i}`} className="text-xs text-muted-foreground px-1">
                          …
                        </span>
                      ) : (
                        <Button
                          key={p}
                          variant={currentPage === p ? "default" : "outline"}
                          size="sm"
                          className="h-7 w-7 p-0 text-xs"
                          onClick={() => setCurrentPage(p as number)}
                        >
                          {p}
                        </Button>
                      ),
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Preview Modal */}
      <Dialog open={Boolean(previewDoc)} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              {previewDoc && <CategoryBadge category={previewDoc.category} />}
              {previewDoc && <StatusBadge status={previewDoc.status} />}
            </div>
            <DialogTitle className="font-display text-lg leading-snug">
              {previewDoc?.title}
            </DialogTitle>
            <DialogDescription className="text-xs font-mono">
              Source: {previewDoc && formatSourceFileName(previewDoc.storage_path)} &middot;{" "}
              {previewDoc?.file_size && (previewDoc.file_size / (1024 * 1024)).toFixed(2)} MB
              {previewDoc?.page_count ? ` · ${previewDoc.page_count} pages` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto my-2 p-4 rounded-lg bg-surface-muted border border-border text-xs leading-relaxed font-mono whitespace-pre-wrap text-foreground select-text">
            {previewDoc?.extracted_text || "No extracted text content available for this document."}
          </div>

          <DialogFooter className="sm:justify-between items-center">
            <span className="text-[11px] text-muted-foreground font-mono">
              Added {previewDoc && new Date(previewDoc.created_at).toLocaleDateString()}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPreviewDoc(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Evidence Document?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">{deleteTarget?.title}</strong> will be permanently
              removed from your corporate evidence base and will no longer be used during tender
              requirement matching.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Remove Evidence
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
