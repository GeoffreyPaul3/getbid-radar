import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
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
  const { workspace } = useWorkspace();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [requirements, setRequirements] = useState<OpportunityRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [matchFilter, setMatchFilter] = useState("all");
  const [mandatoryOnly, setMandatoryOnly] = useState(false);

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

  // Extract distinct categories
  const categories = Array.from(
    new Set(requirements.map((r) => r.category || r.req_type).filter(Boolean)),
  );

  const filtered = requirements.filter((r) => {
    const textMatches =
      !searchQuery.trim() ||
      r.requirement.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.reasoning && r.reasoning.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.evidence && r.evidence.toLowerCase().includes(searchQuery.toLowerCase()));

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

    const mandatoryPass = !mandatoryOnly || Boolean(r.is_mandatory);

    return textMatches && catMatches && matchFilterPass && mandatoryPass;
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

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">
            <Link to="/tenders" className="hover:text-foreground">
              Tenders
            </Link>
            <span>/</span>
            <Link
              to="/tenders/$id"
              params={{ id: id || "" }}
              className="hover:text-foreground truncate max-w-xs"
            >
              {opportunity?.title || "Tender"}
            </Link>
            <span>/</span>
            <span className="text-foreground">Requirements Matrix</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <span>Requirements Compliance Matrix</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Line-by-line RFP requirements extracted by the Phase 2 AI engine, mapped to verified
            company facts.
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-border gap-6 text-sm font-medium">
          <Link
            to="/tenders/$id"
            params={{ id: id || "" }}
            className="pb-3 text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" /> Intelligence Report
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

          <Button
            variant={mandatoryOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setMandatoryOnly(!mandatoryOnly)}
            className="h-10 text-xs font-mono shrink-0"
          >
            Mandatory Only
          </Button>
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
          <div className="space-y-4">
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
                  className={`p-5 rounded-xl border bg-card shadow-sm transition-all hover:border-accent/40 ${
                    isMandatory ? "border-l-4 border-l-accent" : "border-border/80"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <MatchBadge match={req.company_match} status={req.status} />

                      {isMandatory && (
                        <Badge
                          variant="destructive"
                          className="font-mono text-[9px] py-0 px-1.5 uppercase"
                        >
                          Mandatory Blocker
                        </Badge>
                      )}

                      {req.category && (
                        <span className="font-mono text-[10px] uppercase bg-secondary px-2 py-0.5 rounded text-foreground font-medium">
                          {req.category}
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
                        <span>Conf: {Math.round(Number(req.match_confidence) * 100)}%</span>
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
                          <CheckCircle2 className="h-3 w-3" /> Verified Corporate Evidence:
                        </span>
                        <p className="text-foreground leading-relaxed bg-surface/50 p-2 rounded border border-border/40 font-mono text-[11px]">
                          {req.evidence}
                        </p>
                      </div>
                    )}

                    {req.evidence_needed && (
                      <div className="space-y-1">
                        <span className="font-mono uppercase text-[10px] font-bold text-accent flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Missing Evidence Required:
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

                  {/* Task CTA */}
                  <div className="mt-3 pt-2 border-t border-border/30 flex justify-end">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Link to="/tenders/$id/workspace" params={{ id: id || "" }}>
                        Prepare Task in Workspace <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
