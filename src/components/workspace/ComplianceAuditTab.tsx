import React, { useState, useEffect, useCallback } from "react";
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
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Filter,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  runComplianceAuditFn,
  getLatestAuditFn,
  updateFindingStatusFn,
} from "@/lib/compliance/compliance.functions";
import type { Database } from "@/integrations/supabase/types";

type FindingRow = Database["public"]["Tables"]["compliance_findings"]["Row"];
type AuditRow = Database["public"]["Tables"]["compliance_audits"]["Row"];

interface ComplianceAuditTabProps {
  opportunityId: string;
  workspaceId: string;
}

export function ComplianceAuditTab({ opportunityId, workspaceId }: ComplianceAuditTabProps) {
  const [audit, setAudit] = useState<AuditRow | null>(null);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLatestAuditFn({ data: { opportunityId, workspaceId } });
      if (res) {
        setAudit(res.audit);
        setFindings(res.findings);
      } else {
        setAudit(null);
        setFindings([]);
      }
    } catch (err) {
      console.error("[Compliance] Load error:", err);
      toast.error("Failed to load compliance audit data");
    } finally {
      setLoading(false);
    }
  }, [opportunityId, workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunAudit = async () => {
    setIsRunningAudit(true);
    try {
      toast.info("Running deterministic + AI compliance audit across tender materials...");
      const result = await runComplianceAuditFn({ data: { opportunityId } });
      toast.success(
        `Audit v${result.version} complete: Readiness Score ${result.readinessScore}/100 (${result.readinessLabel})`,
      );
      await loadData();
    } catch (err) {
      toast.error("Compliance audit failed", { description: (err as Error).message });
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleStatusChange = async (findingId: string, newStatus: string) => {
    try {
      await updateFindingStatusFn({
        data: {
          findingId,
          workspaceId,
          status: newStatus as "open" | "acknowledged" | "resolved" | "waived",
        },
      });
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, status: newStatus } : f)),
      );
      toast.success("Finding status updated");
    } catch (err) {
      toast.error("Failed to update status", { description: (err as Error).message });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    if (severityFilter !== "all" && f.severity !== severityFilter) return false;
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    return true;
  });

  const criticalCount = findings.filter((f) => f.severity === "critical" && f.status === "open").length;
  const highCount = findings.filter((f) => f.severity === "high" && f.status === "open").length;
  const openCount = findings.filter((f) => f.status === "open").length;
  const score = audit?.readiness_score ?? null;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-accent" />
            Pre-Submission Compliance Auditor
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated verification of mandatory criteria, required attachments, and proposal
            consistency.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleRunAudit}
          disabled={isRunningAudit}
          className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-xs gap-1.5 self-start sm:self-auto"
        >
          {isRunningAudit ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {audit ? "Re-run Compliance Audit" : "Run Initial Compliance Audit"}
        </Button>
      </div>

      {/* ── Audit Summary Cards ── */}
      {audit ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border/80 bg-card p-4 space-y-1.5">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">
              Audit Readiness Score
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={`font-display text-2xl font-bold ${
                  (score ?? 0) >= 80
                    ? "text-emerald-500"
                    : (score ?? 0) >= 50
                      ? "text-amber-500"
                      : "text-destructive"
                }`}
              >
                {score ?? 0}
              </span>
              <span className="text-xs font-mono text-muted-foreground">/ 100</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              Audit Version {audit.version} · {audit.status}
            </p>
          </Card>

          <Card
            className={`border p-4 space-y-1.5 ${
              criticalCount > 0
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-border/80 bg-card"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Critical Blockers
              </span>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div className="font-display text-2xl font-bold text-destructive">{criticalCount}</div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {criticalCount > 0 ? "Must resolve before submission" : "No critical blockers"}
            </p>
          </Card>

          <Card className="border border-border/80 bg-card p-4 space-y-1.5">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">
              High Risk Findings
            </span>
            <div className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
              {highCount}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {highCount > 0 ? "High risk of disqualification" : "No high-risk issues"}
            </p>
          </Card>

          <Card className="border border-border/80 bg-card p-4 space-y-1.5">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">
              Open Findings
            </span>
            <div className="font-display text-2xl font-bold text-foreground">{openCount}</div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {findings.length - openCount} resolved or waived
            </p>
          </Card>
        </div>
      ) : (
        <Card className="border border-dashed p-8 text-center bg-surface/20 space-y-3">
          <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <p className="font-display text-base font-semibold text-foreground">
              No compliance audit has been performed yet
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Run the compliance auditor to check your proposal sections and evidence records
              against mandatory tender eligibility requirements.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleRunAudit}
            disabled={isRunningAudit}
            className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold gap-1.5"
          >
            {isRunningAudit ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Run Audit Now
          </Button>
        </Card>
      )}

      {/* ── Findings Section ── */}
      {findings.length > 0 && (
        <Card className="border border-border/80 shadow-panel bg-card">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-accent" />
                  Compliance Findings ({findings.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Review identified gaps and update their resolution status.
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="h-8 text-xs w-32">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="waived">Waived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-3">
            {filteredFindings.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No findings match the selected filters.
              </p>
            ) : (
              filteredFindings.map((f) => {
                const isCritical = f.severity === "critical";
                const isHigh = f.severity === "high";
                const isResolved = f.status === "resolved" || f.status === "waived";

                return (
                  <div
                    key={f.id}
                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                      isResolved
                        ? "border-border/40 bg-surface/20 opacity-70"
                        : isCritical
                          ? "border-destructive/30 bg-destructive/5"
                          : isHigh
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-border/60 bg-surface/40"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={isCritical ? "destructive" : "outline"}
                            className={`font-mono text-[9px] uppercase ${
                              isHigh
                                ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                                : ""
                            }`}
                          >
                            {f.severity}
                          </Badge>
                          <Badge variant="secondary" className="font-mono text-[9px] uppercase">
                            {f.category?.replace(/_/g, " ")}
                          </Badge>
                          {f.source_reference && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Ref: {f.source_reference}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-foreground pt-1">{f.requirement}</p>
                      </div>

                      {/* Status Dropdown */}
                      <div className="shrink-0">
                        <Select
                          value={f.status}
                          onValueChange={(val) => handleStatusChange(f.id, val)}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-32 font-mono">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="acknowledged">Acknowledged</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="waived">Waived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Problem description */}
                    {f.problem && (
                      <div className="p-2.5 rounded-lg bg-background/60 border border-border/40 text-xs text-muted-foreground space-y-1">
                        <span className="text-[10px] font-mono uppercase text-destructive font-semibold">
                          Deficiency / Risk:
                        </span>
                        <p>{f.problem}</p>
                      </div>
                    )}

                    {/* Recommended fix */}
                    {f.recommended_fix && (
                      <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/20 text-xs space-y-1">
                        <span className="text-[10px] font-mono uppercase text-accent font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Recommended Remediation:
                        </span>
                        <p className="text-foreground">{f.recommended_fix}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
