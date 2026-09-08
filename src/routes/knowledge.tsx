import React, { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { processKnowledgeDocumentFn } from "@/lib/knowledge.functions";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type KnowledgeDocument = Database["public"]["Tables"]["knowledge_documents"]["Row"];

export const Route = createFileRoute("/knowledge")({
  component: KnowledgeBasePage,
});

function KnowledgeBasePage() {
  const { workspace } = useWorkspace();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Upload Dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("certification");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } finally {
      setIsLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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

  const handleDelete = async (docId: string, storagePath: string) => {
    try {
      await supabase.storage.from("documents").remove([storagePath]);
      const { error } = await supabase.from("knowledge_documents").delete().eq("id", docId);
      if (error) throw error;
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Evidence document removed");
    } catch (err) {
      toast.error("Failed to delete", { description: (err as Error).message });
    }
  };

  const filtered = documents.filter((doc) => {
    const matchesSearch =
      !searchQuery.trim() ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.category && doc.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat = categoryFilter === "all" || doc.category === categoryFilter;

    return matchesSearch && matchesCat;
  });

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              Corporate Evidence Base
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Maintain the verified corporate qualification documents, certifications, and case
              studies used by the Phase 2 evidence matcher.
            </p>
          </div>

          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground font-medium">
                <PlusCircle className="h-4 w-4 mr-2" /> Upload Evidence Document
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
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Evidence Category</Label>
                    <Select value={uploadCategory} onValueChange={setUploadCategory}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="certification">
                          Certification & Accreditations
                        </SelectItem>
                        <SelectItem value="case_study">Case Study / Past Performance</SelectItem>
                        <SelectItem value="financial_statement">
                          Financial Statements & Audits
                        </SelectItem>
                        <SelectItem value="technical_specification">
                          Technical Capabilities / Whitepaper
                        </SelectItem>
                        <SelectItem value="reference_letter">Client Reference Letter</SelectItem>
                        <SelectItem value="policy">Corporate Policy / Compliance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:bg-surface/50 transition-colors"
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
                        <Upload className="h-5 w-5 text-accent mx-auto mb-1" />
                        <p className="font-medium text-xs">Click to select PDF or DOCX</p>
                        <p className="text-[10px] text-muted-foreground">Up to 25MB</p>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setUploadOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!uploadFile || isUploading}>
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Upload & Index
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search & Filter Strip */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search evidence titles, categories, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-card text-xs"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-56 h-10 bg-card text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="certification">Certifications</SelectItem>
              <SelectItem value="case_study">Past Performance</SelectItem>
              <SelectItem value="financial_statement">Financial Statements</SelectItem>
              <SelectItem value="technical_specification">Technical Capabilities</SelectItem>
              <SelectItem value="reference_letter">Reference Letters</SelectItem>
              <SelectItem value="policy">Corporate Policies</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Document Cards / Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-card rounded-xl border border-border">
            <Loader2 className="h-8 w-8 animate-spin text-accent mb-2" />
            <p className="text-xs text-muted-foreground font-mono">Loading evidence library...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border border-border/80 shadow-panel bg-card text-center p-12 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground mx-auto">
              <BookOpen className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-foreground">
                {searchQuery || categoryFilter !== "all"
                  ? "No matching evidence documents"
                  : "No Corporate Evidence Uploaded Yet"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                {searchQuery || categoryFilter !== "all"
                  ? "Try resetting your filter parameters."
                  : "Upload company capability statements, certifications, and project references so the requirement matching engine can verify RFP compliance."}
              </p>
            </div>
            <Button onClick={() => setUploadOpen(true)} className="mt-2">
              <PlusCircle className="h-4 w-4 mr-2" /> Upload First Evidence Document
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-xl border border-border/80 bg-card shadow-sm hover:border-accent/40 transition-colors flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase bg-secondary px-2 py-0.5 rounded text-foreground font-medium">
                      {doc.category}
                    </span>
                    <Badge
                      variant={doc.status === "completed" ? "default" : "outline"}
                      className="font-mono text-[9px] uppercase"
                    >
                      {doc.status}
                    </Badge>
                  </div>

                  <h3
                    className="font-display font-semibold text-sm text-foreground leading-snug line-clamp-2 break-words"
                    title={doc.title}
                  >
                    {doc.title}
                  </h3>

                  {doc.extracted_text && (
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {doc.extracted_text.slice(0, 180)}...
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>
                    {doc.file_size ? `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB` : "File"} •{" "}
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(doc.id, doc.storage_path)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
