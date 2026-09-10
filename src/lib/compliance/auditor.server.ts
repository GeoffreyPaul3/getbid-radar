/**
 * Pre-Submission Compliance Auditor
 * Deterministic + AI-assisted engine that evaluates proposal readiness
 * against tender requirements, submission checklist, and evidence records.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callStructuredAi } from "@/lib/ai/gateway.server";
import { z } from "zod";

export type Client = SupabaseClient<Database>;

export type FindingSeverity = Database["public"]["Enums"]["finding_severity"];
export type FindingStatus = "open" | "acknowledged" | "resolved" | "waived";
export type FindingCategory =
  | "mandatory_eligibility"
  | "submission_documents"
  | "evaluation_criteria"
  | "consistency_check"
  | "technical_compliance";

export interface ComplianceFinding {
  id?: string | undefined;
  severity: FindingSeverity;
  category: FindingCategory;
  status: FindingStatus;
  requirement?: string | undefined;
  problem: string;
  evidence?: string | undefined;
  recommended_fix: string;
  source_reference?: string | undefined;
}

export interface ComplianceAuditResult {
  auditId: string;
  version: number;
  readinessScore: number;
  readinessLabel: "READY" | "REVIEW" | "NOT_READY";
  findings: ComplianceFinding[];
  passedCount: number;
  openCount: number;
  criticalCount: number;
  highCount: number;
  ranAt: string;
}

/** Calculate a deterministic readiness score from findings */
function calculateReadinessScore(findings: ComplianceFinding[]): number {
  let score = 100;
  let criticalPenalty = 0;
  let highPenalty = 0;
  let mediumPenalty = 0;
  let inconsistencyPenalty = 0;

  for (const f of findings) {
    if (f.status === "resolved" || f.status === "waived") continue;
    if (f.severity === "critical") {
      criticalPenalty = Math.min(criticalPenalty + 20, 60);
    } else if (f.severity === "high") {
      highPenalty = Math.min(highPenalty + 10, 30);
    } else if (f.severity === "medium") {
      mediumPenalty = Math.min(mediumPenalty + 5, 15);
    }
    if (f.category === "consistency_check" && f.severity !== "low") {
      inconsistencyPenalty = Math.min(inconsistencyPenalty + 10, 20);
    }
  }

  score -= criticalPenalty + highPenalty + mediumPenalty + inconsistencyPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

const aiComplianceFindingsSchema = z.object({
  findings: z.array(
    z.object({
      severity: z.enum(["critical", "high", "medium", "low"]),
      category: z.enum([
        "mandatory_eligibility",
        "submission_documents",
        "evaluation_criteria",
        "consistency_check",
        "technical_compliance",
      ]),
      requirement: z.string().max(500).optional(),
      problem: z.string().max(1000),
      evidence: z.string().max(800).optional(),
      recommended_fix: z.string().max(800),
      source_reference: z.string().max(300).optional(),
    }),
  ),
});

export async function runComplianceAudit(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
): Promise<ComplianceAuditResult> {
  // 1. Resolve or establish bid_workspace
  let { data: bw } = await supabase
    .from("bid_workspaces")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (!bw) {
    const { data: createdBw, error: bwErr } = await supabase
      .from("bid_workspaces")
      .insert({
        workspace_id: workspaceId,
        opportunity_id: opportunityId,
        status: "preparing",
      })
      .select("id")
      .single();
    if (bwErr || !createdBw) {
      throw new Error(`Failed to initialize bid workspace: ${bwErr?.message}`);
    }
    bw = createdBw;
  }

  const bidWorkspaceId = bw.id;

  // 2. Fetch opportunity, requirements, proposal documents, knowledge evidence
  const [{ data: opportunity }, { data: requirements }, { data: proposalDocs }, { data: evidenceDocs }] =
    await Promise.all([
      supabase
        .from("opportunities")
        .select("id, title, category, deadline, description")
        .eq("id", opportunityId)
        .eq("workspace_id", workspaceId)
        .single(),
      supabase
        .from("opportunity_requirements")
        .select("id, requirement, category, importance, is_mandatory, evidence_needed, company_match")
        .eq("opportunity_id", opportunityId)
        .eq("workspace_id", workspaceId),
      supabase
        .from("proposal_documents")
        .select("id, title, content, section_type, completeness_status")
        .eq("bid_workspace_id", bidWorkspaceId)
        .eq("workspace_id", workspaceId),
      supabase
        .from("knowledge_documents")
        .select("id, title, category, extracted_text")
        .eq("workspace_id", workspaceId)
        .limit(20),
    ]);

  if (!opportunity) {
    throw new Error(`Opportunity not found: ${opportunityId}`);
  }

  // 3. Determine next version number
  const { data: existingAudits } = await supabase
    .from("compliance_audits")
    .select("id, version")
    .eq("bid_workspace_id", bidWorkspaceId)
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = (existingAudits?.[0]?.version ?? 0) + 1;

  // 4. Deterministic checks (mandatory requirements without matched evidence)
  const deterministicFindings: ComplianceFinding[] = [];
  const mandatoryReqs = (requirements ?? []).filter((r) => r.is_mandatory);
  const proposalText = (proposalDocs ?? []).map((d) => d.content ?? "").join("\n\n");
  const evidenceText = (evidenceDocs ?? [])
    .map((e) => `[${e.category}] ${e.title}: ${e.extracted_text?.slice(0, 200) ?? ""}`)
    .join("\n");

  for (const req of mandatoryReqs) {
    const isAddressed = proposalText.toLowerCase().includes(req.requirement.toLowerCase().slice(0, 25));
    if (!isAddressed && proposalText.length < 50) {
      deterministicFindings.push({
        severity: req.importance === "critical" ? "critical" : "high",
        category: "mandatory_eligibility",
        status: "open",
        requirement: req.requirement,
        problem: `Mandatory requirement "${req.requirement.slice(0, 80)}" has no corresponding proposal section or drafted evidence.`,
        recommended_fix: `Draft a proposal section specifically addressing: ${req.requirement}`,
        source_reference: req.category ?? undefined,
      });
    }
  }

  // 5. AI-assisted compliance findings
  let aiFindings: ComplianceFinding[] = [];
  try {
    const systemPrompt = `You are a rigorous bid compliance auditor for government and enterprise procurement. Your task is to identify specific, concrete compliance gaps between the tender requirements and the company's submission materials. Be precise and actionable. Never fabricate issues. Maximum 12 findings.`;

    const userPrompt = `TENDER TITLE: ${opportunity.title}
CATEGORY: ${opportunity.category || "General"}
DEADLINE: ${opportunity.deadline || "Not specified"}
DESCRIPTION: ${opportunity.description || "Not available"}

MANDATORY REQUIREMENTS (${mandatoryReqs.length} total):
${mandatoryReqs.slice(0, 20).map((r) => `- [${r.importance?.toUpperCase() || "HIGH"}] ${r.requirement}${r.evidence_needed ? ` | Evidence needed: ${r.evidence_needed}` : ""}`).join("\n")}

PROPOSAL SECTIONS DRAFTED (${proposalDocs?.length ?? 0} sections):
${(proposalDocs ?? []).map((d) => `- [${d.section_type || "custom"}] ${d.title} (${d.completeness_status || "draft"})`).join("\n") || "NONE — No proposal sections exist yet"}

COMPANY EVIDENCE ON FILE:
${evidenceText.slice(0, 2000) || "No evidence records found in workspace"}

Identify all compliance gaps, missing documents, evaluation coverage gaps, and consistency issues.`;

    const aiResult = await callStructuredAi({
      system: systemPrompt,
      user: userPrompt,
      toolName: "compliance_audit_findings",
      toolDescription: "Return identified compliance gaps and findings for the bid submission",
      jsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["findings"],
        properties: {
          findings: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["severity", "category", "problem", "recommended_fix"],
              properties: {
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                category: {
                  type: "string",
                  enum: [
                    "mandatory_eligibility",
                    "submission_documents",
                    "evaluation_criteria",
                    "consistency_check",
                    "technical_compliance",
                  ],
                },
                requirement: { type: ["string", "null"] },
                problem: { type: "string" },
                evidence: { type: ["string", "null"] },
                recommended_fix: { type: "string" },
                source_reference: { type: ["string", "null"] },
              },
            },
          },
        },
      },
      schema: aiComplianceFindingsSchema,
      temperature: 0,
    });

    if (aiResult.ok) {
      aiFindings = (aiResult.data.findings ?? []).map((f) => ({
        ...f,
        status: "open" as FindingStatus,
      }));
    } else {
      console.warn("[ComplianceAuditor] AI analysis failed:", aiResult.message);
    }
  } catch (aiErr) {
    console.warn("[ComplianceAuditor] AI analysis threw, using deterministic only:", aiErr);
  }

  const allFindings = [...deterministicFindings, ...aiFindings];

  // 6. Calculate readiness score
  const readinessScore = calculateReadinessScore(allFindings);
  const readinessLabel: "READY" | "REVIEW" | "NOT_READY" =
    readinessScore >= 80 ? "READY" : readinessScore >= 50 ? "REVIEW" : "NOT_READY";

  const ranAt = new Date().toISOString();

  // 7. Create audit record
  const { data: audit, error: auditErr } = await supabase
    .from("compliance_audits")
    .insert({
      workspace_id: workspaceId,
      bid_workspace_id: bidWorkspaceId,
      version: nextVersion,
      readiness_score: readinessScore,
      status: "completed",
      summary: `Compliance audit v${nextVersion}: ${allFindings.length} findings, score ${readinessScore}/100.`,
      error_message: null,
    })
    .select("id")
    .single();

  if (auditErr || !audit) {
    throw new Error(`Failed to create compliance audit record: ${auditErr?.message}`);
  }

  // 8. Insert findings
  if (allFindings.length > 0) {
    const findingRows = allFindings.map((f) => ({
      workspace_id: workspaceId,
      audit_id: audit.id,
      severity: f.severity,
      status: f.status,
      category: f.category,
      requirement: f.requirement || f.problem,
      problem: f.problem,
      recommended_fix: f.recommended_fix,
      evidence: f.evidence || null,
      source_reference: f.source_reference || null,
      resolved: f.status === "resolved" || f.status === "waived",
    }));
    await supabase.from("compliance_findings").insert(findingRows);
  }

  const criticalCount = allFindings.filter((f) => f.severity === "critical" && f.status === "open").length;
  const highCount = allFindings.filter((f) => f.severity === "high" && f.status === "open").length;
  const openCount = allFindings.filter((f) => f.status === "open").length;
  const passedCount = mandatoryReqs.length - criticalCount - highCount;

  return {
    auditId: audit.id,
    version: nextVersion,
    readinessScore,
    readinessLabel,
    findings: allFindings,
    passedCount: Math.max(0, passedCount),
    openCount,
    criticalCount,
    highCount,
    ranAt,
  };
}

export async function updateFindingStatus(
  supabase: Client,
  workspaceId: string,
  findingId: string,
  status: FindingStatus,
): Promise<void> {
  const resolved = status === "resolved" || status === "waived";
  const { error } = await supabase
    .from("compliance_findings")
    .update({ status, resolved })
    .eq("id", findingId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(`Failed to update finding status: ${error.message}`);
}

export async function getLatestAudit(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
): Promise<{
  audit: Database["public"]["Tables"]["compliance_audits"]["Row"];
  findings: Database["public"]["Tables"]["compliance_findings"]["Row"][];
} | null> {
  const { data: bw } = await supabase
    .from("bid_workspaces")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (!bw) return null;

  const { data: audit } = await supabase
    .from("compliance_audits")
    .select("*")
    .eq("bid_workspace_id", bw.id)
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!audit) return null;

  const { data: findings } = await supabase
    .from("compliance_findings")
    .select("*")
    .eq("audit_id", audit.id)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  return { audit, findings: findings ?? [] };
}
