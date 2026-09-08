/**
 * Bid-intelligence orchestrator.
 *
 * Coordinates: opportunity load -> tender text -> requirement extraction ->
 * requirement persistence -> evidence retrieval -> matching -> qualitative
 * assessment -> deterministic scoring -> persistence -> activity + usage.
 *
 * Everything is workspace-scoped through the authenticated Supabase client the
 * caller supplies; no workspace id is ever taken from the browser.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  assessOpportunity,
  extractRequirements,
  matchRequirements,
  BID_INTELLIGENCE_VERSION,
  type CompanyFacts,
  type MatchRequirementInput,
  type OpportunityFacts,
} from "@/lib/ai/operations.server";
import { loadEvidenceBundle, retrieveEvidence, type EvidenceItem } from "@/lib/ai/evidence.server";
import type { AiUsage } from "@/lib/ai/gateway.server";
import { scoreOpportunity, type ScoredRequirement } from "@/lib/scoring/engine";
import type { ExtractedRequirement, RequirementCategory, MatchVerdict } from "@/lib/ai/schemas";

export type Client = SupabaseClient<Database>;

export const ANALYSIS_ENGINE_VERSION = BID_INTELLIGENCE_VERSION;

export type PipelineStage =
  | "EXTRACTION"
  | "REQUIREMENT_EXTRACTION"
  | "REQUIREMENT_VALIDATION"
  | "EVIDENCE_RETRIEVAL"
  | "MATCHING"
  | "ASSESSMENT"
  | "SCORING"
  | "PERSISTENCE";

export type PipelineFailure = {
  ok: false;
  stage: PipelineStage;
  code: string;
  message: string;
};

export type PipelineSuccess = {
  ok: true;
  analysisId: string;
  version: number;
  score: number;
  recommendation: "bid" | "review" | "no_bid";
  confidence: number;
  reused: boolean;
};

export type PipelineResult = PipelineSuccess | PipelineFailure;

const fail = (stage: PipelineStage, code: string, message: string): PipelineFailure => ({
  ok: false,
  stage,
  code,
  message,
});

/* ------------------------------------------------------------------ */
/* Deterministic helpers (pure, unit-tested)                           */
/* ------------------------------------------------------------------ */

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeRequirementText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable identity of a requirement, used for idempotent upserts. */
export function requirementFingerprint(r: {
  title: string;
  category: string;
  is_mandatory: boolean;
}): string {
  return sha256(
    `${normalizeRequirementText(r.title)}|${r.category}|${r.is_mandatory ? "m" : "o"}`,
  ).slice(0, 40);
}

/** Identity of the analysis inputs; identical inputs must not re-run the AI. */
export function inputsFingerprint(input: {
  opportunityId: string;
  documents: Array<{ id: string; updatedAt: string; charCount: number | null }>;
  companySignature: string;
  engineVersion: string;
}): string {
  const docs = [...input.documents]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => `${d.id}:${d.updatedAt}:${d.charCount ?? 0}`)
    .join(",");
  return sha256(`${input.engineVersion}|${input.opportunityId}|${docs}|${input.companySignature}`);
}

export function companySignature(company: CompanyFacts): string {
  return sha256(
    JSON.stringify({
      p: company.profile,
      c: company.capabilities,
      x: company.certifications,
      j: company.projects,
      t: company.team,
      r: company.referenceCount,
    }),
  ).slice(0, 32);
}

const CATEGORY_TO_REQ_TYPE: Record<
  RequirementCategory,
  Database["public"]["Enums"]["requirement_type"]
> = {
  eligibility: "eligibility",
  legal_registration: "legal",
  financial: "financial",
  technical: "technical",
  capability: "technical",
  experience: "experience",
  certification: "certification",
  staffing: "experience",
  equipment_resources: "technical",
  geographic: "delivery",
  commercial: "commercial",
  delivery: "delivery",
  timeline: "delivery",
  documentation: "documentation",
  compliance: "legal",
  other: "technical",
};

export function verdictToStatus(
  verdict: MatchVerdict,
  evidenceCount: number,
): Database["public"]["Enums"]["requirement_status"] {
  switch (verdict) {
    case "match":
      return "pass";
    case "partial":
      return "partial";
    case "no_match":
      return "fail";
    default:
      return evidenceCount === 0 ? "missing" : "needs_review";
  }
}

/** ISO date (YYYY-MM-DD) or null — never guess. */
export function parseDueDate(value: string | null): string | null {
  if (!value) return null;
  const direct = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function normalizeRequirement(
  r: ExtractedRequirement,
  analysisVersion: number,
): {
  requirement: string;
  req_type: Database["public"]["Enums"]["requirement_type"];
  category: string;
  is_mandatory: boolean;
  importance: string;
  source_page: number | null;
  source_section: string | null;
  source_reference: string | null;
  extraction_confidence: number;
  evidence_needed: string | null;
  threshold_value: string | null;
  due_date: string | null;
  reasoning: string | null;
  is_ambiguous: boolean;
  analysis_version: number;
  fingerprint: string;
  sourceDocumentName: string | null;
} {
  const title = r.title.trim();
  return {
    requirement: title,
    req_type: CATEGORY_TO_REQ_TYPE[r.category],
    category: r.category,
    is_mandatory: r.is_mandatory,
    importance: r.importance,
    source_page: r.source_page ?? null,
    source_section: r.source_section?.trim() || null,
    source_reference: r.source_quote?.trim() || null,
    extraction_confidence: r.confidence,
    evidence_needed: r.evidence_needed?.trim() || null,
    threshold_value: r.threshold_value?.trim() || null,
    due_date: parseDueDate(r.deadline),
    reasoning: r.description?.trim() || null,
    is_ambiguous: r.is_ambiguous,
    analysis_version: analysisVersion,
    fingerprint: requirementFingerprint({
      title,
      category: r.category,
      is_mandatory: r.is_mandatory,
    }),
    sourceDocumentName: r.source_document?.trim() || null,
  };
}

/* ------------------------------------------------------------------ */
/* Logging helpers                                                     */
/* ------------------------------------------------------------------ */

async function logActivity(
  supabase: Client,
  args: {
    workspaceId: string;
    actorId: string;
    action: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("activity_logs").insert({
    workspace_id: args.workspaceId,
    actor_id: args.actorId,
    action: args.action,
    resource_type: "opportunity",
    resource_id: args.resourceId,
    metadata: (args.metadata ?? {}) as never,
  });
}

async function recordUsage(
  supabase: Client,
  args: {
    workspaceId: string;
    actorId: string;
    operation: string;
    resourceId: string;
    usage: AiUsage;
    success: boolean;
    failureCode?: string | undefined;
  },
) {
  await supabase.from("usage_records").insert({
    workspace_id: args.workspaceId,
    actor_id: args.actorId,
    operation: args.operation,
    units: args.usage.totalTokens ?? 0,
    resource_id: args.resourceId,
    metadata: {
      provider: args.usage.activeProvider ?? "gemini",
      model: args.usage.model,
      input_tokens: args.usage.promptTokens ?? null,
      output_tokens: args.usage.completionTokens ?? null,
      duration_ms: args.usage.durationMs,
      attempts: args.usage.attempts,
      success: args.success,
      failure_code: args.failureCode ?? null,
      engine_version: ANALYSIS_ENGINE_VERSION,
    } as never,
  });
}

async function markFailed(
  supabase: Client,
  opportunityId: string,
  workspaceId: string,
  actorId: string,
  failure: PipelineFailure,
  analysisId?: string,
) {
  await supabase
    .from("opportunities")
    .update({
      analysis_status: "failed",
      analysis_stage: failure.stage,
      analysis_error: `${failure.code}: ${failure.message}`,
    })
    .eq("id", opportunityId)
    .eq("workspace_id", workspaceId);

  if (analysisId) {
    await supabase
      .from("opportunity_analyses")
      .update({ status: "failed", error_message: `${failure.code}: ${failure.message}` })
      .eq("id", analysisId)
      .eq("workspace_id", workspaceId);
  }

  await logActivity(supabase, {
    workspaceId,
    actorId,
    action: "analysis_failed",
    resourceId: opportunityId,
    metadata: { stage: failure.stage, code: failure.code, message: failure.message },
  });
}

/* ------------------------------------------------------------------ */
/* Orchestrator                                                        */
/* ------------------------------------------------------------------ */

export async function runOpportunityAnalysis(args: {
  supabase: Client;
  userId: string;
  opportunityId: string;
  force?: boolean;
  now?: Date;
}): Promise<PipelineResult> {
  const { supabase, userId, opportunityId } = args;
  const now = args.now ?? new Date();

  /* --- load opportunity (RLS scopes this to the caller's workspaces) --- */
  const { data: opportunity, error: oppError } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", opportunityId)
    .maybeSingle();

  if (oppError) return fail("PERSISTENCE", "OPPORTUNITY_LOAD_FAILED", oppError.message);
  if (!opportunity)
    return fail("PERSISTENCE", "NOT_FOUND", "Opportunity not found in your workspace.");

  const workspaceId = opportunity.workspace_id;

  /* --- documents + extracted text --- */
  const { data: documents, error: docError } = await supabase
    .from("opportunity_documents")
    .select("id, file_name, role, status, extracted_text, char_count, updated_at, error_message")
    .eq("opportunity_id", opportunityId)
    .eq("workspace_id", workspaceId);

  if (docError) return fail("EXTRACTION", "DOCUMENT_LOAD_FAILED", docError.message);

  const ready = (documents ?? []).filter(
    (d) => d.status === "completed" && (d.extracted_text?.trim().length ?? 0) > 0,
  );

  const inlineText = [opportunity.description, opportunity.scope].filter(Boolean).join("\n\n");

  if (ready.length === 0 && inlineText.trim().length < 200) {
    return fail(
      "EXTRACTION",
      "EXTRACTION_FAILED",
      "No extracted tender text is available. Upload and process at least one tender document first.",
    );
  }

  /* --- company evidence --- */
  let bundle;
  try {
    bundle = await loadEvidenceBundle(supabase, workspaceId);
  } catch (error) {
    return fail("EVIDENCE_RETRIEVAL", "EVIDENCE_RETRIEVAL_FAILED", (error as Error).message);
  }

  const fingerprint = inputsFingerprint({
    opportunityId,
    documents: ready.map((d) => ({ id: d.id, updatedAt: d.updated_at, charCount: d.char_count })),
    companySignature: companySignature(bundle.company),
    engineVersion: ANALYSIS_ENGINE_VERSION,
  });

  /* --- idempotency: identical inputs, already completed --- */
  const { data: existing } = await supabase
    .from("opportunity_analyses")
    .select("id, version, status, bidradar_score, recommendation, confidence, inputs_fingerprint")
    .eq("opportunity_id", opportunityId)
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(20);

  const completedMatch = (existing ?? []).find(
    (a) => a.status === "completed" && a.inputs_fingerprint === fingerprint,
  );
  if (completedMatch && !args.force) {
    return {
      ok: true,
      analysisId: completedMatch.id,
      version: completedMatch.version,
      score: completedMatch.bidradar_score ?? 0,
      recommendation: (completedMatch.recommendation ??
        "review") as PipelineSuccess["recommendation"],
      confidence: Number(completedMatch.confidence ?? 0),
      reused: true,
    };
  }

  const nextVersion = ((existing ?? [])[0]?.version ?? 0) + 1;

  /* --- create the analysis row up-front so failures are persisted --- */
  const { data: analysisRow, error: createError } = await supabase
    .from("opportunity_analyses")
    .insert({
      workspace_id: workspaceId,
      opportunity_id: opportunityId,
      version: nextVersion,
      status: "processing",
      engine_version: ANALYSIS_ENGINE_VERSION,
      inputs_fingerprint: fingerprint,
      model: null,
    })
    .select("id, version")
    .single();

  if (createError || !analysisRow) {
    return fail(
      "PERSISTENCE",
      "PERSISTENCE_FAILED",
      createError?.message ?? "Could not create analysis.",
    );
  }
  const analysisId = analysisRow.id;

  await supabase
    .from("opportunities")
    .update({
      analysis_status: "processing",
      analysis_stage: "REQUIREMENT_EXTRACTION",
      analysis_error: null,
      status: opportunity.status === "new" ? "analyzing" : opportunity.status,
    })
    .eq("id", opportunityId)
    .eq("workspace_id", workspaceId);

  await logActivity(supabase, {
    workspaceId,
    actorId: userId,
    action: "analysis_started",
    resourceId: opportunityId,
    metadata: { analysis_id: analysisId, version: nextVersion, engine: ANALYSIS_ENGINE_VERSION },
  });

  const opportunityFacts: OpportunityFacts = {
    title: opportunity.title,
    buyer: opportunity.buyer,
    buyerLocation: opportunity.buyer_location,
    category: opportunity.category,
    location: opportunity.location,
    contractValue: opportunity.contract_value,
    currency: opportunity.currency,
    deadline: opportunity.deadline,
    description: opportunity.description,
    scope: opportunity.scope,
  };

  /* --- 1. requirement extraction --- */
  const sources = ready.map((d) => ({
    fileName: d.file_name,
    role: d.role,
    text: d.extracted_text as string,
  }));
  if (sources.length === 0 && inlineText.trim().length > 0) {
    sources.push({ fileName: "opportunity notice", role: "notice", text: inlineText });
  }

  const extraction = await extractRequirements({ opportunity: opportunityFacts, sources });
  await recordUsage(supabase, {
    workspaceId,
    actorId: userId,
    operation: "ai.requirement_extraction",
    resourceId: opportunityId,
    usage: extraction.usage,
    success: extraction.ok,
    failureCode: extraction.ok ? undefined : extraction.code,
  });

  if (!extraction.ok) {
    const failure = fail(
      "REQUIREMENT_EXTRACTION",
      extraction.code === "timeout"
        ? "AI_PROVIDER_TIMEOUT"
        : extraction.code === "provider_error" || extraction.code === "rate_limited"
          ? "AI_PROVIDER_ERROR"
          : "REQUIREMENT_EXTRACTION_FAILED",
      extraction.message,
    );
    await markFailed(supabase, opportunityId, workspaceId, userId, failure, analysisId);
    return failure;
  }

  if (extraction.data.requirements.length === 0) {
    const failure = fail(
      "REQUIREMENT_VALIDATION",
      "REQUIREMENT_VALIDATION_FAILED",
      "No requirements could be identified in the supplied tender documents.",
    );
    await markFailed(supabase, opportunityId, workspaceId, userId, failure, analysisId);
    return failure;
  }

  /* --- 2. persist requirements idempotently --- */
  const docIdByName = new Map(ready.map((d) => [d.file_name.toLowerCase(), d.id]));
  const normalized = extraction.data.requirements.map((r) => normalizeRequirement(r, nextVersion));

  const seen = new Set<string>();
  const rows = normalized
    .filter((r) => (seen.has(r.fingerprint) ? false : (seen.add(r.fingerprint), true)))
    .map(({ sourceDocumentName, ...r }) => ({
      ...r,
      workspace_id: workspaceId,
      opportunity_id: opportunityId,
      status: "needs_review" as const,
      source_document_id: sourceDocumentName
        ? (docIdByName.get(sourceDocumentName.toLowerCase()) ?? null)
        : null,
    }));

  const { error: reqError } = await supabase
    .from("opportunity_requirements")
    .upsert(rows, { onConflict: "opportunity_id,fingerprint", ignoreDuplicates: false });

  if (reqError) {
    const failure = fail("PERSISTENCE", "PERSISTENCE_FAILED", reqError.message);
    await markFailed(supabase, opportunityId, workspaceId, userId, failure, analysisId);
    return failure;
  }

  const { data: storedRequirements, error: loadReqError } = await supabase
    .from("opportunity_requirements")
    .select(
      "id, requirement, category, is_mandatory, importance, threshold_value, evidence_needed, reasoning, fingerprint, human_edited",
    )
    .eq("opportunity_id", opportunityId)
    .eq("workspace_id", workspaceId);

  if (loadReqError || !storedRequirements) {
    const failure = fail(
      "PERSISTENCE",
      "PERSISTENCE_FAILED",
      loadReqError?.message ?? "load failed",
    );
    await markFailed(supabase, opportunityId, workspaceId, userId, failure, analysisId);
    return failure;
  }

  await logActivity(supabase, {
    workspaceId,
    actorId: userId,
    action: "requirements_extracted",
    resourceId: opportunityId,
    metadata: { count: storedRequirements.length, analysis_id: analysisId },
  });

  /* --- 3. evidence retrieval + ranking --- */
  const matchInputs: MatchRequirementInput[] = storedRequirements.map((r) => ({
    ref: r.id,
    title: r.requirement,
    description: r.reasoning ?? "",
    category: r.category ?? "other",
    isMandatory: r.is_mandatory,
    importance: r.importance,
    thresholdValue: r.threshold_value,
    evidenceNeeded: r.evidence_needed,
  }));

  const { byRequirement, unique } = retrieveEvidence(
    bundle.pool,
    matchInputs.map((r) => ({
      ref: r.ref,
      query: `${r.title} ${r.description} ${r.evidenceNeeded ?? ""} ${r.thresholdValue ?? ""}`,
    })),
  );

  /* --- 4. matching --- */
  await supabase
    .from("opportunities")
    .update({ analysis_stage: "MATCHING" })
    .eq("id", opportunityId)
    .eq("workspace_id", workspaceId);

  const matching = await matchRequirements({
    requirements: matchInputs,
    company: bundle.company,
    evidence: unique,
  });
  await recordUsage(supabase, {
    workspaceId,
    actorId: userId,
    operation: "ai.requirement_matching",
    resourceId: opportunityId,
    usage: matching.usage,
    success: matching.ok,
    failureCode: matching.ok ? undefined : matching.code,
  });

  if (!matching.ok) {
    const failure = fail(
      "MATCHING",
      matching.code === "timeout" ? "AI_PROVIDER_TIMEOUT" : "MATCHING_FAILED",
      matching.message,
    );
    await markFailed(supabase, opportunityId, workspaceId, userId, failure, analysisId);
    return failure;
  }

  const matchByRef = new Map(matching.data.matches.map((m) => [m.requirement_ref, m]));

  /* --- persist match results + evidence references --- */
  const evidenceRows: Database["public"]["Tables"]["evidence_references"]["Insert"][] = [];
  const reqUpdatePromises: Array<PromiseLike<{ error: { message: string } | null }>> = [];

  for (const r of storedRequirements) {
    const match = matchByRef.get(r.id);
    const ranked = byRequirement.get(r.id) ?? [];
    const cited: EvidenceItem[] = match?.evidence_ids?.length
      ? ranked.filter((e) => match.evidence_ids.includes(e.id))
      : [];
    const evidenceCount = cited.length;

    if (!r.human_edited) {
      reqUpdatePromises.push(
        supabase
          .from("opportunity_requirements")
          .update({
            status: verdictToStatus((match?.verdict ?? "unknown") as MatchVerdict, evidenceCount),
            company_match: match?.verdict ?? "unknown",
            match_confidence: match?.confidence ?? 0,
            evidence: cited.length
              ? cited
                  .map((e) => `${e.label}${e.excerpt ? `: ${e.excerpt.slice(0, 400)}` : ""}`)
                  .join("\n")
              : "Evidence not found",
            risk: match?.risk ?? null,
            action_required: match?.action_required ?? null,
            reasoning: match?.reasoning ?? r.reasoning,
            analysis_version: nextVersion,
          })
          .eq("id", r.id)
          .eq("workspace_id", workspaceId),
      );
    }

    for (const e of cited) {
      evidenceRows.push({
        workspace_id: workspaceId,
        requirement_id: r.id,
        analysis_id: analysisId,
        origin: e.origin,
        label: e.label,
        excerpt: e.excerpt?.slice(0, 2000) ?? null,
        knowledge_document_id: e.knowledgeDocumentId,
        company_project_id: e.companyProjectId,
        certification_id: e.certificationId,
        source_reference: e.sourceReference,
      });
    }
  }

  if (reqUpdatePromises.length > 0) {
    const updateResults = await Promise.all(reqUpdatePromises);
    const failedUpdate = updateResults.find((res) => res.error);
    if (failedUpdate?.error) {
      const failure = fail("PERSISTENCE", "PERSISTENCE_FAILED", failedUpdate.error.message);
      await markFailed(supabase, opportunityId, workspaceId, userId, failure, analysisId);
      return failure;
    }
  }

  if (evidenceRows.length > 0) {
    const { error: evError } = await supabase.from("evidence_references").insert(evidenceRows);
    if (evError) {
      const failure = fail("PERSISTENCE", "PERSISTENCE_FAILED", evError.message);
      await markFailed(supabase, opportunityId, workspaceId, userId, failure, analysisId);
      return failure;
    }
  }

  await logActivity(supabase, {
    workspaceId,
    actorId: userId,
    action: "requirements_matched",
    resourceId: opportunityId,
    metadata: { count: matching.data.matches.length, analysis_id: analysisId },
  });

  /* --- 5. qualitative assessment --- */
  await supabase
    .from("opportunities")
    .update({ analysis_stage: "ASSESSMENT" })
    .eq("id", opportunityId)
    .eq("workspace_id", workspaceId);

  const assessment = await assessOpportunity({
    opportunity: opportunityFacts,
    company: bundle.company,
    tenderSummary: extraction.data.tender_summary,
    now,
    matchSummary: storedRequirements.map((r) => {
      const m = matchByRef.get(r.id);
      return {
        title: r.requirement,
        isMandatory: r.is_mandatory,
        importance: r.importance,
        verdict: m?.verdict ?? "unknown",
        confidence: m?.confidence ?? 0,
        reasoning: m?.reasoning ?? "Evidence not found",
      };
    }),
  });
  await recordUsage(supabase, {
    workspaceId,
    actorId: userId,
    operation: "ai.bid_assessment",
    resourceId: opportunityId,
    usage: assessment.usage,
    success: assessment.ok,
    failureCode: assessment.ok ? undefined : assessment.code,
  });

  if (!assessment.ok) {
    const failure = fail(
      "ASSESSMENT",
      assessment.code === "timeout" ? "AI_PROVIDER_TIMEOUT" : "ASSESSMENT_FAILED",
      assessment.message,
    );
    await markFailed(supabase, opportunityId, workspaceId, userId, failure, analysisId);
    return failure;
  }

  /* --- 6. deterministic scoring --- */
  const scoredRequirements: ScoredRequirement[] = storedRequirements.map((r) => {
    const m = matchByRef.get(r.id);
    const cited = (byRequirement.get(r.id) ?? []).filter((e) =>
      (m?.evidence_ids ?? []).includes(e.id),
    );
    return {
      id: r.id,
      title: r.requirement,
      isMandatory: r.is_mandatory,
      importance: (["critical", "high", "medium", "low"] as const).includes(
        r.importance as "critical",
      )
        ? (r.importance as ScoredRequirement["importance"])
        : "medium",
      verdict: (m?.verdict ?? "unknown") as ScoredRequirement["verdict"],
      confidence: m?.confidence ?? 0,
      evidenceCount: cited.length,
    };
  });

  let scoring;
  try {
    scoring = scoreOpportunity({
      assessment: assessment.data.components,
      requirements: scoredRequirements,
      deadline: opportunity.deadline,
      now,
    });
  } catch (error) {
    const failure = fail("SCORING", "SCORING_FAILED", (error as Error).message);
    await markFailed(supabase, opportunityId, workspaceId, userId, failure, analysisId);
    return failure;
  }

  /* --- 7. persist analysis + score components --- */
  const blockers = scoring.mandatoryFailures
    .filter((f) => f.kind === "confirmed")
    .map((f) => `${f.title}: ${f.reason}`);

  const { error: updateError } = await supabase
    .from("opportunity_analyses")
    .update({
      status: "completed",
      bidradar_score: Math.round(scoring.score),
      recommendation: scoring.recommendation,
      confidence: scoring.confidence,
      evidence_coverage: scoring.evidenceCoverage,
      engine_version: ANALYSIS_ENGINE_VERSION,
      executive_summary: assessment.data.executive_summary,
      reasoning: scoring.recommendationReasons.join(" "),
      positive_factors: assessment.data.strengths,
      negative_factors: assessment.data.weaknesses,
      strengths: assessment.data.strengths,
      weaknesses: assessment.data.weaknesses,
      critical_blockers: blockers,
      required_actions: assessment.data.required_actions,
      missing_evidence: assessment.data.evidence_gaps,
      open_questions: assessment.data.open_questions,
      risks: assessment.data.risks as never,
      recommended_strategy: assessment.data.recommended_strategy,
      estimated_effort_hours_min: assessment.data.estimated_effort_hours_min,
      estimated_effort_hours_max: assessment.data.estimated_effort_hours_max,
      winability: scoring.recommendationReasons[0] ?? null,
      model: assessment.usage.model,
      error_message: null,
    })
    .eq("id", analysisId)
    .eq("workspace_id", workspaceId);

  if (updateError) {
    const failure = fail("PERSISTENCE", "PERSISTENCE_FAILED", updateError.message);
    await markFailed(supabase, opportunityId, workspaceId, userId, failure, analysisId);
    return failure;
  }

  await supabase.from("score_components").delete().eq("analysis_id", analysisId);
  const { error: compError } = await supabase.from("score_components").insert(
    scoring.components.map((c) => ({
      workspace_id: workspaceId,
      analysis_id: analysisId,
      key: c.key,
      label: c.label,
      score: c.score,
      weight: c.weight,
      confidence: c.confidence,
      blocking: c.blocking,
      rationale: c.rationale,
    })),
  );

  if (compError) {
    const failure = fail("PERSISTENCE", "PERSISTENCE_FAILED", compError.message);
    await markFailed(supabase, opportunityId, workspaceId, userId, failure, analysisId);
    return failure;
  }

  await supabase
    .from("opportunities")
    .update({
      analysis_status: "completed",
      analysis_stage: null,
      analysis_error: null,
      status: "analyzed",
    })
    .eq("id", opportunityId)
    .eq("workspace_id", workspaceId);

  await logActivity(supabase, {
    workspaceId,
    actorId: userId,
    action: "analysis_completed",
    resourceId: opportunityId,
    metadata: {
      analysis_id: analysisId,
      version: nextVersion,
      score: scoring.score,
      recommendation: scoring.recommendation,
      confidence: scoring.confidence,
    },
  });

  return {
    ok: true,
    analysisId,
    version: nextVersion,
    score: scoring.score,
    recommendation: scoring.recommendation,
    confidence: scoring.confidence,
    reused: false,
  };
}
