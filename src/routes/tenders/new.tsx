import React, { useState, useRef, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  CheckCircle2,
  Lock,
  ChevronLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ingestTenderUploadFn, ingestTenderUrlFn } from "@/lib/tender-intake.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/tenders/new")({
  component: NewTenderPage,
});

function NewTenderPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { workspace, isLoading: wsLoading } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({
        to: "/login",
        search: { redirect: "/tenders/new" },
      });
    }
  }, [authLoading, user, navigate]);

  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");

  // Shared metadata
  const [customTitle, setCustomTitle] = useState("");
  const [buyer, setBuyer] = useState("");

  // Upload Tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL Tab state
  const [url, setUrl] = useState("");
  const [isIngestingUrl, setIsIngestingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
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
          mimeType: selectedFile.type || "application/octet-stream",
          title: customTitle.trim() || undefined,
          buyer: buyer.trim() || undefined,
        },
      });

      toast.success("Tender ingested! Analysis launched.", { id: toastId });
      navigate({
        to: "/tenders/$id",
        params: { id: result.opportunityId },
      });
    } catch (err) {
      toast.error("Upload failed", {
        id: toastId,
        description: (err as Error).message,
      });
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

  if (authLoading || (!workspace && wsLoading)) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-xs text-muted-foreground font-mono">
            Verifying workspace credentials...
          </p>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link
            to="/tenders"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to Tenders
          </Link>
        </div>

        {/* Title Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-primary">
              Intake Channel
            </span>
            <span className="text-border-strong">•</span>
            <span className="text-[11px] font-mono text-muted-foreground">Two-Mode Ingestion</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Analyse Tender Documents
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Upload the tender document package or enter a public portal URL. Requirements will be
            extracted and evaluated against company evidence immediately.
          </p>
        </div>

        {/* Ingestion Card */}
        <Card className="border border-border shadow-panel bg-surface">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "url")}>
            <div className="p-4 sm:p-6 pb-2 border-b border-border/70">
              <TabsList className="grid w-full grid-cols-2 bg-surface-muted p-1 rounded-lg border border-border/60">
                <TabsTrigger
                  value="upload"
                  className="font-medium text-xs flex items-center justify-center gap-2 py-2 data-[state=active]:bg-surface data-[state=active]:text-primary data-[state=active]:shadow-subtle"
                >
                  <Upload className="h-3.5 w-3.5" /> 1. Upload Tender Document
                </TabsTrigger>
                <TabsTrigger
                  value="url"
                  className="font-medium text-xs flex items-center justify-center gap-2 py-2 data-[state=active]:bg-surface data-[state=active]:text-primary data-[state=active]:shadow-subtle"
                >
                  <Link2 className="h-3.5 w-3.5" /> 2. Paste Tender URL
                </TabsTrigger>
              </TabsList>
            </div>

            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Optional Common Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-border/60">
                <div className="space-y-1.5">
                  <Label htmlFor="tender-title" className="text-xs font-semibold text-foreground">
                    Tender Title (Optional override)
                  </Label>
                  <Input
                    id="tender-title"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Auto-extracted from document if empty"
                    className="h-9 text-xs rounded-lg border-border bg-surface"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tender-buyer" className="text-xs font-semibold text-foreground">
                    Issuing Authority / Buyer
                  </Label>
                  <Input
                    id="tender-buyer"
                    value={buyer}
                    onChange={(e) => setBuyer(e.target.value)}
                    placeholder="e.g. Department of Infrastructure"
                    className="h-9 text-xs rounded-lg border-border bg-surface"
                  />
                </div>
              </div>

              {/* TAB 1: FILE UPLOAD */}
              <TabsContent value="upload" className="m-0 space-y-4">
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-150 ${
                      isDragging
                        ? "border-primary bg-primary-soft/40"
                        : selectedFile
                          ? "border-primary/50 bg-primary-soft/20"
                          : "border-border hover:border-primary/60 bg-surface-muted/30 hover:bg-surface-muted/60"
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
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-subtle">
                          <FileText className="h-6 w-6" />
                        </div>
                        <p className="font-display font-bold text-foreground text-sm mt-1">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Ingestion
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-foreground mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                        >
                          Change File
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-subtle">
                          <Upload className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-display font-bold text-sm text-foreground">
                            Click to select or drag tender document package
                          </p>
                          <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                            Supports PDF, DOCX, XLSX, TXT, or ZIP specification packages (up to
                            50MB).
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <Lock className="h-3.5 w-3.5 text-bid" />
                      <span>Private Tenant Storage Isolation</span>
                    </div>

                    <Button
                      type="submit"
                      disabled={!selectedFile || isUploading}
                      className="bg-primary text-white hover:bg-primary-bright shadow-subtle h-10 px-5 text-xs font-semibold"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          <span>Extracting & Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <span>Ingest & Launch Analysis</span>
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
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
                    <Label htmlFor="tender-url" className="text-xs font-semibold text-foreground">
                      Public Procurement Notice URL
                    </Label>
                    <Input
                      id="tender-url"
                      type="url"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (urlError) setUrlError(null);
                      }}
                      placeholder="https://procurement.example.gov/notices/2026/tender-specification"
                      className={`h-10 text-xs rounded-lg border-border bg-surface ${
                        urlError ? "border-nobid focus-visible:ring-nobid" : ""
                      }`}
                    />
                    {urlError && (
                      <p className="text-xs text-nobid font-medium flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {urlError}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      GetBidRadar safely retrieves the public notice content via server-side fetch
                      with SSRF mitigation.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <ShieldCheck className="h-3.5 w-3.5 text-bid" />
                      <span>SSRF-Protected Request</span>
                    </div>

                    <Button
                      type="submit"
                      disabled={!url.trim() || isIngestingUrl}
                      className="bg-primary text-white hover:bg-primary-bright shadow-subtle h-10 px-5 text-xs font-semibold"
                    >
                      {isIngestingUrl ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          <span>Fetching & Ingesting...</span>
                        </>
                      ) : (
                        <>
                          <span>Fetch & Launch Analysis</span>
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
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
