/**
 * Proposal Server — Grounded AI proposal drafting, section management, and versioning.
 * AI is strictly forbidden from inventing facts. Missing evidence is flagged inline.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callStructuredAi } from "@/lib/ai/gateway.server";
import { z } from "zod";

export type Client = SupabaseClient<Database>;
export type ProposalDocRecord = Database["public"]["Tables"]["proposal_documents"]["Row"];

export const PROPOSAL_SECTION_TYPES = [
  "executive_summary",
  "understanding_of_requirements",
  "company_profile",
  "technical_approach",
  "methodology",
  "work_plan",
  "team_and_cvs",
  "relevant_experience",
  "case_studies",
  "deliverables",
  "timeline",
  "risk_management",
  "quality_assurance",
  "financial_proposal",
  "compliance_statements",
  "references",
  "additional_information",
  "custom",
] as const;

export type ProposalSectionType = (typeof PROPOSAL_SECTION_TYPES)[number];

export async function getOrCreateBidWorkspace(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
  userId?: string | null,
): Promise<string> {
  const { data: existing } = await supabase
    .from("bid_workspaces")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("bid_workspaces")
    .insert({
      workspace_id: workspaceId,
      opportunity_id: opportunityId,
      owner_id: userId ?? null,
      status: "preparing",
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Failed to initialize bid workspace: ${error?.message}`);
  }
  return created.id;
}

/** Derive section completeness from content length and evidence gaps */
function deriveCompleteness(
  content: string | null,
): "draft" | "in_progress" | "complete" | "evidence_required" {
  if (!content || content.trim().length < 50) return "draft";
  if (content.includes("[Evidence required:")) return "evidence_required";
  if (content.trim().length > 500) return "complete";
  return "in_progress";
}

/**
 * Draft a proposal section using AI, strictly grounded in company evidence.
 * Any claim without evidence is marked [Evidence required: <description>].
 */
export async function draftProposalSection(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
  sectionType: ProposalSectionType,
  sectionTitle: string,
  additionalContext?: string,
): Promise<{ content: string; evidenceGaps: string[] }> {
  // Fetch context: requirements, company profile, evidence, existing opportunity
  const [{ data: opp }, { data: requirements }, { data: docs }, { data: companyProfile }] =
    await Promise.all([
      supabase
        .from("opportunities")
        .select("title, description, category")
        .eq("id", opportunityId)
        .eq("workspace_id", workspaceId)
        .single(),
      supabase
        .from("opportunity_requirements")
        .select("requirement, category, importance, is_mandatory, evidence_needed")
        .eq("opportunity_id", opportunityId)
        .eq("workspace_id", workspaceId)
        .limit(30),
      supabase
        .from("knowledge_documents")
        .select("title, category, extracted_text")
        .eq("workspace_id", workspaceId)
        .limit(15),
      supabase
        .from("company_profiles")
        .select("company_name, industry, description, country, currency, employee_count, website, years_in_operation")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
    ]);

  const evidenceSummary = (docs ?? [])
    .map((e) => `[${e.category}] ${e.title}: ${e.extracted_text?.slice(0, 300) ?? ""}`)
    .join("\n");

  const requirementsSummary = (requirements ?? [])
    .map((r) => `- [${r.importance?.toUpperCase() || "REQ"}] ${r.requirement}${r.evidence_needed ? ` (Evidence: ${r.evidence_needed})` : ""}`)
    .join("\n");

  const draftSchema = z.object({
    content: z.string().max(8000),
    evidence_gaps: z.array(z.string()).max(20),
  });

  const systemPrompt = `You are a world-class proposal writer for enterprise and public procurement.
Your task is to draft a rigorous, professional, compelling response section for a tender submission.

CRITICAL ANTI-HALLUCINATION RULES:
1. Ground every substantive capability claim in the company profile or evidence provided.
2. If a requirement cannot be substantiated from the provided evidence, you MUST flag it inline with:
   [Evidence required: <exact document, certification, or case study needed>]
3. NEVER invent employee qualifications, past contract values, revenue figures, or proprietary tool names.
4. Adopt an authoritative, professional, and compliant tone.
5. Use clean Markdown headings (###), bullet points, and tables where appropriate.`;

  const userPrompt = `TENDER TITLE: ${opp?.title || "Tender Proposal"}
CATEGORY: ${opp?.category || "General"}
OVERVIEW: ${opp?.description?.slice(0, 500) || "Standard procurement"}

SECTION TO DRAFT: ${sectionTitle} (${sectionType})
${additionalContext ? `USER GUIDANCE: ${additionalContext}\n` : ""}

COMPANY PROFILE:
- Name: ${companyProfile?.company_name || "Our Company"}
- Industry: ${companyProfile?.industry || "Professional Services"}
- Country: ${companyProfile?.country || "Malawi"}
- Experience: ${companyProfile?.years_in_operation ? `${companyProfile.years_in_operation} years in operation` : "Established provider"}
- Staff: ${companyProfile?.employee_count ? `${companyProfile.employee_count} employees` : "Professional team"}
- Description: ${companyProfile?.description || "Specialized solutions provider"}

TENDER REQUIREMENTS:
${requirementsSummary || "No specific requirements extracted."}

EVIDENCE REPOSITORY RECORDS:
${evidenceSummary || "No evidence records uploaded yet."}

Draft the complete section content now. Return the draft content and a list of identified evidence gaps.`;

  const result = await callStructuredAi({
    system: systemPrompt,
    user: userPrompt,
    toolName: "draft_proposal_section",
    toolDescription: "Return the drafted proposal section content and list of evidence gaps",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["content", "evidence_gaps"],
      properties: {
        content: {
          type: "string",
          description: "The complete drafted proposal section in Markdown format",
        },
        evidence_gaps: {
          type: "array",
          items: { type: "string" },
          description: "List of specific evidentiary items needed to substantiate the claims",
        },
      },
    },
    schema: draftSchema,
    temperature: 0.2,
  });

  if (!result.ok) {
    return {
      content: `[Draft generation failed: ${result.message}. Please write this section manually.]`,
      evidenceGaps: [],
    };
  }

  return {
    content: result.data.content,
    evidenceGaps: result.data.evidence_gaps,
  };
}

/** Save or update a proposal section, incrementing version on each save */
export async function saveProposalSection(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
  userId: string,
  sectionData: {
    id?: string | undefined;
    title: string;
    content: string;
    section_type: string;
    requirement_ids?: string[] | undefined;
    evidence_references?: unknown[] | undefined;
  },
): Promise<{ id: string; version: number }> {
  const completeness_status = deriveCompleteness(sectionData.content);
  const bidWorkspaceId = await getOrCreateBidWorkspace(supabase, workspaceId, opportunityId, userId);

  if (sectionData.id) {
    // Fetch current version
    const { data: existing } = await supabase
      .from("proposal_documents")
      .select("version")
      .eq("id", sectionData.id)
      .eq("workspace_id", workspaceId)
      .single();

    const nextVersion = (existing?.version ?? 1) + 1;

    const { error } = await supabase
      .from("proposal_documents")
      .update({
        title: sectionData.title,
        content: sectionData.content,
        section_type: sectionData.section_type,
        requirement_ids: sectionData.requirement_ids ?? [],
        evidence_references: (sectionData.evidence_references as never) ?? [],
        completeness_status,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sectionData.id)
      .eq("workspace_id", workspaceId);

    if (error) throw new Error(`Failed to update proposal section: ${error.message}`);
    return { id: sectionData.id, version: nextVersion };
  } else {
    const { data, error } = await supabase
      .from("proposal_documents")
      .insert({
        workspace_id: workspaceId,
        bid_workspace_id: bidWorkspaceId,
        created_by: userId,
        title: sectionData.title,
        content: sectionData.content,
        section_type: sectionData.section_type,
        requirement_ids: sectionData.requirement_ids ?? [],
        evidence_references: (sectionData.evidence_references as never) ?? [],
        completeness_status,
        version: 1,
        is_current: true,
        generated_by: "user",
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(`Failed to create proposal section: ${error?.message}`);
    return { id: data.id, version: 1 };
  }
}

/** List all proposal sections for an opportunity */
export async function listProposalSections(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
): Promise<ProposalDocRecord[]> {
  const bidWorkspaceId = await getOrCreateBidWorkspace(supabase, workspaceId, opportunityId);
  const { data } = await supabase
    .from("proposal_documents")
    .select("*")
    .eq("bid_workspace_id", bidWorkspaceId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

/** Export all proposal sections as a combined Markdown document */
export async function exportProposal(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
): Promise<{ title: string; markdown: string }> {
  const { data: opp } = await supabase
    .from("opportunities")
    .select("title")
    .eq("id", opportunityId)
    .eq("workspace_id", workspaceId)
    .single();

  const sections = await listProposalSections(supabase, workspaceId, opportunityId);
  const title = opp?.title ? `Proposal - ${opp.title}` : "Proposal Document";

  let markdown = `# ${title}\n\nGenerated via GetBidRadar\nDate: ${new Date().toLocaleDateString()}\n\n---\n\n`;

  for (const s of sections) {
    markdown += `## ${s.title}\n\n${s.content}\n\n---\n\n`;
  }

  return { title, markdown };
}

/** Calculate proposal completeness score (0–100) */
export async function calculateProposalCompleteness(
  supabase: Client,
  workspaceId: string,
  opportunityId: string,
): Promise<{ score: number; drafted: number; total: number; hasEvidenceGaps: boolean }> {
  const sections = await listProposalSections(supabase, workspaceId, opportunityId);

  const coreTypes = ["executive_summary", "technical_approach", "financial_proposal"];
  const drafted = sections.filter((s) =>
    ["in_progress", "complete", "evidence_required"].includes(s.completeness_status ?? "draft"),
  ).length;
  const completed = sections.filter((s) => s.completeness_status === "complete").length;
  const total = Math.max(sections.length, coreTypes.length);
  const hasEvidenceGaps = sections.some((s) =>
    s.content?.includes("[Evidence required:"),
  );

  const score = total === 0 ? 0 : Math.round(((completed * 2 + drafted) / (total * 2)) * 100);
  return { score: Math.min(100, score), drafted, total, hasEvidenceGaps };
}
