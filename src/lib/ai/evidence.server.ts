/**
 * Company evidence retrieval and ranking.
 *
 * Workspace-scoped: the caller passes an authenticated Supabase client and a
 * workspace id already resolved from the session. Nothing here accepts a
 * client-supplied workspace.
 *
 * Retrieval is lexical (token overlap + field weighting) today. The
 * `EvidenceItem` abstraction is deliberately storage-agnostic so a semantic /
 * vector retriever can be added later without touching the matching engine.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CompanyFacts } from "./operations.server";

export type EvidenceOrigin =
  | "company_profile"
  | "capability"
  | "certification"
  | "project"
  | "reference"
  | "team_member"
  | "knowledge_chunk";

export type EvidenceItem = {
  /** Stable id used by the model to cite this evidence. */
  id: string;
  origin: EvidenceOrigin;
  /** Row id in the originating table, when the origin has one. */
  sourceId: string | null;
  knowledgeDocumentId: string | null;
  companyProjectId: string | null;
  certificationId: string | null;
  label: string;
  excerpt: string | null;
  sourceReference: string | null;
  /** 0..1 lexical relevance for the requirement it was retrieved for. */
  relevance: number;
  /** How authoritative the evidence is, independent of relevance. */
  strength: "strong" | "moderate" | "weak";
};

export type EvidenceBundle = {
  company: CompanyFacts;
  /** Every candidate evidence item, unranked. */
  pool: EvidenceItem[];
  /** True when the workspace has essentially no company evidence on file. */
  empty: boolean;
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "shall", "must", "will", "have", "has",
  "are", "any", "all", "from", "into", "not", "your", "our", "their", "been", "such",
  "each", "least", "than", "years", "year", "provide", "evidence", "bidder", "tenderer",
  "requirement", "required", "documents", "document", "including", "include", "minimum",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[-./]+|[-./]+$/g, ""))
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/** Weighted token overlap: how much of the query is covered by the candidate. */
export function relevanceScore(query: string, candidate: string): number {
  const q = tokenize(query);
  if (q.length === 0) return 0;
  const c = new Set(tokenize(candidate));
  if (c.size === 0) return 0;
  let hits = 0;
  for (const token of new Set(q)) {
    if (c.has(token)) hits += 1;
  }
  return hits / new Set(q).size;
}

const STRENGTH_BOOST: Record<EvidenceItem["strength"], number> = {
  strong: 1,
  moderate: 0.85,
  weak: 0.65,
};

const ORIGIN_PRIORITY: Record<EvidenceOrigin, number> = {
  certification: 1,
  capability: 0.98,
  project: 0.96,
  company_profile: 0.94,
  team_member: 0.9,
  reference: 0.88,
  knowledge_chunk: 0.8,
};

function text(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" — ");
}

type Client = SupabaseClient<Database>;

/**
 * Load every piece of company evidence for a workspace once, so a whole
 * analysis run performs a fixed, small number of queries.
 */
export async function loadEvidenceBundle(
  supabase: Client,
  workspaceId: string,
): Promise<EvidenceBundle> {
  const [profileRes, capsRes, certsRes, projectsRes, refsRes, teamRes, chunksRes] =
    await Promise.all([
      supabase.from("company_profiles").select("*").eq("workspace_id", workspaceId).maybeSingle(),
      supabase.from("company_capabilities").select("*").eq("workspace_id", workspaceId).limit(500),
      supabase.from("company_certifications").select("*").eq("workspace_id", workspaceId).limit(500),
      supabase.from("company_projects").select("*").eq("workspace_id", workspaceId).limit(500),
      supabase.from("company_references").select("*").eq("workspace_id", workspaceId).limit(500),
      supabase.from("team_members").select("*").eq("workspace_id", workspaceId).limit(500),
      supabase
        .from("knowledge_chunks")
        .select("id, document_id, chunk_index, page_number, section, content")
        .eq("workspace_id", workspaceId)
        .limit(2000),
    ]);

  const firstError =
    profileRes.error ??
    capsRes.error ??
    certsRes.error ??
    projectsRes.error ??
    refsRes.error ??
    teamRes.error ??
    chunksRes.error;
  if (firstError) throw new Error(`EVIDENCE_RETRIEVAL_FAILED: ${firstError.message}`);

  const profile = profileRes.data ?? null;
  const capabilities = capsRes.data ?? [];
  const certifications = certsRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const references = refsRes.data ?? [];
  const team = teamRes.data ?? [];
  const chunks = chunksRes.data ?? [];

  const pool: EvidenceItem[] = [];

  if (profile) {
    pool.push({
      id: "profile:1",
      origin: "company_profile",
      sourceId: profile.id,
      knowledgeDocumentId: null,
      companyProjectId: null,
      certificationId: null,
      label: `Company profile: ${profile.company_name}`,
      excerpt: text(
        profile.description,
        profile.industry ? `Industry: ${profile.industry}` : null,
        profile.country ? `Country: ${profile.country}` : null,
        profile.years_in_operation != null ? `Years in operation: ${profile.years_in_operation}` : null,
        profile.employee_count != null ? `Employees: ${profile.employee_count}` : null,
        profile.annual_turnover != null
          ? `Annual turnover: ${profile.annual_turnover} ${profile.currency}`
          : null,
        profile.geographic_coverage?.length
          ? `Geographic coverage: ${profile.geographic_coverage.join(", ")}`
          : null,
        profile.preferred_industries?.length
          ? `Preferred industries: ${profile.preferred_industries.join(", ")}`
          : null,
        profile.min_contract_value != null || profile.max_contract_value != null
          ? `Contract value range: ${profile.min_contract_value ?? "?"}–${profile.max_contract_value ?? "?"} ${profile.currency}`
          : null,
      ),
      sourceReference: "company profile record",
      relevance: 0,
      strength: "strong",
    });
  }

  for (const c of capabilities) {
    pool.push({
      id: `capability:${c.id}`,
      origin: "capability",
      sourceId: c.id,
      knowledgeDocumentId: null,
      companyProjectId: null,
      certificationId: null,
      label: `Capability: ${c.name} (${c.kind})`,
      excerpt: text(c.description),
      sourceReference: "company capability record",
      relevance: 0,
      strength: "strong",
    });
  }

  for (const c of certifications) {
    const expired = c.expiry_date ? new Date(c.expiry_date).getTime() < Date.now() : false;
    pool.push({
      id: `certification:${c.id}`,
      origin: "certification",
      sourceId: c.id,
      knowledgeDocumentId: null,
      companyProjectId: null,
      certificationId: c.id,
      label: `Certification: ${c.name} (${c.kind})`,
      excerpt: text(
        c.issuing_organization ? `Issued by ${c.issuing_organization}` : null,
        c.reference_number ? `Reference ${c.reference_number}` : null,
        c.issue_date ? `Issued ${c.issue_date}` : null,
        c.expiry_date ? `Expires ${c.expiry_date}${expired ? " (EXPIRED)" : ""}` : null,
        `Status: ${c.status}`,
      ),
      sourceReference: "company certification record",
      relevance: 0,
      strength: expired || c.status !== "active" ? "weak" : "strong",
    });
  }

  for (const p of projects) {
    pool.push({
      id: `project:${p.id}`,
      origin: "project",
      sourceId: p.id,
      knowledgeDocumentId: null,
      companyProjectId: p.id,
      certificationId: null,
      label: `Past project: ${p.name}`,
      excerpt: text(
        p.client ? `Client: ${p.client}` : null,
        p.industry ? `Industry: ${p.industry}` : null,
        p.location ? `Location: ${p.location}` : null,
        p.contract_value != null ? `Value: ${p.contract_value} ${p.currency}` : null,
        p.start_date || p.end_date ? `Period: ${p.start_date ?? "?"} to ${p.end_date ?? "?"}` : null,
        p.scope,
        p.services_delivered?.length ? `Services: ${p.services_delivered.join(", ")}` : null,
        p.capabilities?.length ? `Capabilities: ${p.capabilities.join(", ")}` : null,
      ),
      sourceReference: "company project record",
      relevance: 0,
      strength: "strong",
    });
  }

  for (const r of references) {
    pool.push({
      id: `reference:${r.id}`,
      origin: "reference",
      sourceId: r.id,
      knowledgeDocumentId: null,
      companyProjectId: r.project_id,
      certificationId: null,
      label: `Client reference: ${r.client_name}`,
      excerpt: text(r.contact_name, r.notes),
      sourceReference: "client reference record",
      relevance: 0,
      strength: "moderate",
    });
  }

  for (const t of team) {
    pool.push({
      id: `team:${t.id}`,
      origin: "team_member",
      sourceId: t.id,
      knowledgeDocumentId: null,
      companyProjectId: null,
      certificationId: null,
      label: `Team member: ${t.name}${t.role ? ` (${t.role})` : ""}`,
      excerpt: text(
        t.years_experience != null ? `${t.years_experience} years experience` : null,
        t.skills?.length ? `Skills: ${t.skills.join(", ")}` : null,
        t.certifications?.length ? `Certifications: ${t.certifications.join(", ")}` : null,
        t.bio,
      ),
      sourceReference: "team member record",
      relevance: 0,
      strength: "moderate",
    });
  }

  for (const ch of chunks) {
    pool.push({
      id: `chunk:${ch.id}`,
      origin: "knowledge_chunk",
      sourceId: ch.id,
      knowledgeDocumentId: ch.document_id,
      companyProjectId: null,
      certificationId: null,
      label: ch.section ? `Knowledge base — ${ch.section}` : "Knowledge base excerpt",
      excerpt: ch.content,
      sourceReference: ch.page_number != null ? `page ${ch.page_number}` : `chunk ${ch.chunk_index}`,
      relevance: 0,
      strength: "moderate",
    });
  }

  const structuredCount = pool.filter((p) => p.origin !== "knowledge_chunk").length;

  const company: CompanyFacts = {
    profile: profile as unknown as Record<string, unknown> | null,
    capabilities: capabilities.map((c) => ({
      kind: c.kind,
      name: c.name,
      description: c.description,
    })),
    certifications: certifications.map((c) => ({
      name: c.name,
      kind: c.kind,
      status: c.status,
      issuing_organization: c.issuing_organization,
      expiry_date: c.expiry_date,
    })),
    projects: projects.map((p) => ({
      name: p.name,
      client: p.client,
      industry: p.industry,
      location: p.location,
      contract_value: p.contract_value,
      currency: p.currency,
      start_date: p.start_date,
      end_date: p.end_date,
      scope: p.scope,
      services_delivered: p.services_delivered ?? [],
      capabilities: p.capabilities ?? [],
    })),
    team: team.map((t) => ({
      name: t.name,
      role: t.role,
      years_experience: t.years_experience,
      skills: t.skills ?? [],
      certifications: t.certifications ?? [],
    })),
    referenceCount: references.length,
  };

  return { company, pool, empty: structuredCount === 0 && chunks.length === 0 };
}

/**
 * Rank the pool against one requirement. Structured records outrank knowledge
 * text at equal lexical relevance; the profile record is always retained as
 * baseline context because it carries turnover/coverage/size facts.
 */
export function rankEvidenceForRequirement(
  pool: EvidenceItem[],
  query: string,
  limit = 8,
): EvidenceItem[] {
  const scored = pool
    .map((item) => {
      const relevance = relevanceScore(query, `${item.label} ${item.excerpt ?? ""}`);
      return {
        ...item,
        relevance: Math.round(relevance * 100) / 100,
        rank: relevance * STRENGTH_BOOST[item.strength] * ORIGIN_PRIORITY[item.origin],
      };
    })
    .filter((item) => item.relevance > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit);

  const profile = pool.find((p) => p.origin === "company_profile");
  if (profile && !scored.some((s) => s.origin === "company_profile")) {
    scored.push({ ...profile, relevance: 0.1, rank: 0 });
  }

  return scored.map(({ rank: _rank, ...item }) => item);
}

/** Retrieve and de-duplicate evidence across a whole requirement set. */
export function retrieveEvidence(
  pool: EvidenceItem[],
  requirements: Array<{ ref: string; query: string }>,
  perRequirement = 6,
): { byRequirement: Map<string, EvidenceItem[]>; unique: EvidenceItem[] } {
  const byRequirement = new Map<string, EvidenceItem[]>();
  const unique = new Map<string, EvidenceItem>();

  for (const r of requirements) {
    const items = rankEvidenceForRequirement(pool, r.query, perRequirement);
    byRequirement.set(r.ref, items);
    for (const item of items) {
      const existing = unique.get(item.id);
      if (!existing || item.relevance > existing.relevance) unique.set(item.id, item);
    }
  }

  return { byRequirement, unique: [...unique.values()] };
}
