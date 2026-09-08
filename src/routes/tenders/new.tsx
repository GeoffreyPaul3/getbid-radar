import React, { useState, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Link2,
  FileText,
  ArrowRight,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ingestTenderUploadFn, ingestTenderUrlFn } from "@/lib/tender-intake.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/tenders/new")({
  component: NewTenderPage,
});

function NewTenderPage() {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");

  // Shared metadata
  const [customTitle, setCustomTitle] = useState("");
  const [buyer, setBuyer] = useState("");

  // Upload Tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL Tab state
  const [url, setUrl] = useState("");
  const [isIngestingUrl, setIsIngestingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]!;
      setSelectedFile(file);
      if (!customTitle) {
        setCustomTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]!;
      setSelectedFile(file);
      if (!customTitle) {
        setCustomTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !workspace) {
      toast.error("Please select a tender document to upload.");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("Uploading and extracting tender document...");

    try {
      const oppTempId = crypto.randomUUID();
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      // Enforce storage isolation: workspaceId/tenders/opportunityId/filename
      const storagePath = `${workspace.id}/tenders/${oppTempId}/${sanitizedName}`;

      const { error: storageErr } = await supabase.storage
        .from("documents")
        .upload(storagePath, selectedFile, {
          upsert: true,
          contentType: selectedFile.type || "application/octet-stream",
        });

      if (storageErr) {
        throw new Error(`Storage upload failed: ${storageErr.message}`);
      }

      toast.loading("Extracting requirements and launching AI analysis...", { id: toastId });

      const result = await ingestTenderUploadFn({
        data: {
          workspaceId: workspace.id,
          storagePath,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type || "application/pdf",
          title: customTitle.trim() || undefined,
          buyer: buyer.trim() || undefined,
        },
      });

      toast.success("Tender ingested! Analysis in progress.", { id: toastId });
      navigate({
        to: "/tenders/$id",
        params: { id: result.opportunityId },
      });
    } catch (err) {
      const msg = (err as Error).message;
      toast.error("Upload failed", { id: toastId, description: msg });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    if (!url.trim() || !workspace) {
      setUrlError("Please enter a valid tender URL.");
      return;
    }

    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        setUrlError("Only HTTP and HTTPS URLs are supported.");
        return;
      }
    } catch {
      setUrlError("Invalid URL format. Include http:// or https://");
      return;
    }

    setIsIngestingUrl(true);
    const toastId = toast.loading("Safely retrieving tender content from remote URL...");

    try {
      const result = await ingestTenderUrlFn({
        data: {
          workspaceId: workspace.id,
          url: url.trim(),
          title: customTitle.trim() || undefined,
          buyer: buyer.trim() || undefined,
        },
      });

      toast.success("Tender content ingested! Analysis running.", { id: toastId });
      navigate({
        to: "/tenders/$id",
        params: { id: result.opportunityId },
      });
    } catch (err) {
      const msg = (err as Error).message;
      setUrlError(msg);
      toast.error("URL Ingestion failed", { id: toastId, description: msg });
    } finally {
      setIsIngestingUrl(false);
    }
  };

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb & Header */}
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">
            <span>Tenders</span>
            <span>/</span>
            <span className="text-foreground">Intake</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Ingest New Tender
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provide the tender document package or portal URL. The Phase 2 intelligence engine will
            extract mandatory requirements and evaluate your bid alignment immediately.
          </p>
        </div>

        <Card className="border border-border/80 shadow-panel bg-card">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "url")}>
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2 bg-secondary/80">
                <TabsTrigger value="upload" className="font-medium text-xs flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5" /> 1. Upload Tender Package
                </TabsTrigger>
                <TabsTrigger value="url" className="font-medium text-xs flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5" /> 2. Paste Tender URL
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="space-y-6 pt-2">
              {/* Optional Common Metadata Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-border/40">
                <div className="space-y-1.5">
                  <Label htmlFor="tender-title" className="text-xs">
                    Tender Title (Optional override)
                  </Label>
                  <Input
                    id="tender-title"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Auto-extracted if blank"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tender-buyer" className="text-xs">
                    Issuing Buyer / Authority
                  </Label>
                  <Input
                    id="tender-buyer"
                    value={buyer}
                    onChange={(e) => setBuyer(e.target.value)}
                    placeholder="e.g. Department of Transportation"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* TAB 1: FILE UPLOAD */}
              <TabsContent value="upload" className="m-0 space-y-4">
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      selectedFile
                        ? "border-accent bg-accent/5"
                        : "border-border/80 hover:border-accent/60 bg-surface/40 hover:bg-surface/70"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.xlsx,.txt,.zip"
                      onChange={handleFileChange}
                    />

                    {selectedFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground font-mono shadow-sm">
                          <FileText className="h-6 w-6" />
                        </div>
                        <p className="font-display font-semibold text-foreground text-sm mt-1">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Ingestion
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                        >
                          Change File
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                          <Upload className="h-5 w-5 text-accent" />
                        </div>
                        <p className="font-display font-semibold text-sm text-foreground">
                          Click to select or drop tender package
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          Supports RFP specifications, requirements schedules, and bill of
                          quantities in PDF, DOCX, XLSX, TXT, or ZIP archives (up to 50MB).
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <ShieldCheck className="h-4 w-4 text-accent" /> Isolated Private Tenant
                      Storage
                    </div>
                    <Button
                      type="submit"
                      disabled={!selectedFile || isUploading}
                      className="font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ingesting & Analyzing...
                        </>
                      ) : (
                        <>
                          Ingest & Run Intelligence <ArrowRight className="h-4 w-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* TAB 2: URL INTAKE */}
              <TabsContent value="url" className="m-0 space-y-4">
                <form onSubmit={handleUrlSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tender-url" className="text-xs">
                      Public Tender Notice or Specification URL{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="tender-url"
                        type="url"
                        required
                        value={url}
                        onChange={(e) => {
                          setUrl(e.target.value);
                          setUrlError(null);
                        }}
                        placeholder="https://procurement.portal.gov/tenders/notice/2026-8914"
                        className="h-10 text-sm font-mono"
                      />
                    </div>
                    {urlError && (
                      <div className="flex items-center gap-2 text-xs text-destructive mt-1">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{urlError}</span>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Our server will safely retrieve the tender HTML or remote PDF document,
                      extract text content, and trigger automated qualification matching.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-surface/50 p-4 space-y-2 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-accent" /> Enterprise Retrieval Security
                    </p>
                    <p>
                      Remote fetching runs on isolated server runtimes with strict SSRF protection.
                      Internal network subnets, private IP ranges, and unauthorized schemes are
                      blocked.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      Phase 2 Auto-Analysis
                    </span>
                    <Button
                      type="submit"
                      disabled={!url.trim() || isIngestingUrl}
                      className="font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isIngestingUrl ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Fetching & Ingesting...
                        </>
                      ) : (
                        <>
                          Ingest & Run Intelligence <ArrowRight className="h-4 w-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </AppShell>
  );
}
