/**
 * Global Workspace Search Server
 * Fast, workspace-isolated full-text search across all entity types.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Client = SupabaseClient<Database>;

export type SearchResultType =
  "opportunity" | "requirement" | "proposal_section" | "compliance_finding" | "evidence" | "task";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  excerpt: string;
  url: string;
  badge?: string | undefined;
}

function excerpt(text: string | null | undefined, query: string, maxLen = 120): string {
  if (!text) return "";
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, maxLen);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + 80);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export async function workspaceSearch(
  supabase: Client,
  workspaceId: string,
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();
  const results: SearchResult[] = [];

  // Pre-fetch bid_workspaces for this workspace to map bid_workspace_id -> opportunity_id
  const { data: bidWorkspaces } = await supabase
    .from("bid_workspaces")
    .select("id, opportunity_id")
    .eq("workspace_id", workspaceId);

  const bwToOppMap = new Map<string, string>();
  for (const bw of bidWorkspaces ?? []) {
    bwToOppMap.set(bw.id, bw.opportunity_id);
  }

  // 1. Search opportunities
  const { data: opps } = await supabase
    .from("opportunities")
    .select("id, title, description, category")
    .eq("workspace_id", workspaceId)
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(5);

  for (const o of opps ?? []) {
    results.push({
      id: o.id,
      type: "opportunity",
      title: o.title,
      excerpt: excerpt(o.description, q),
      url: `/tenders/${o.id}`,
      badge: o.category ?? undefined,
    });
  }

  // 2. Search requirements
  const { data: reqs } = await supabase
    .from("opportunity_requirements")
    .select("id, requirement, category, opportunity_id")
    .eq("workspace_id", workspaceId)
    .ilike("requirement", `%${q}%`)
    .limit(5);

  for (const r of reqs ?? []) {
    results.push({
      id: r.id,
      type: "requirement",
      title: r.requirement.slice(0, 70),
      excerpt: excerpt(r.requirement, q),
      url: `/tenders/${r.opportunity_id}/requirements`,
      badge: r.category ?? undefined,
    });
  }

  // 3. Search proposal sections
  const { data: proposals } = await supabase
    .from("proposal_documents")
    .select("id, title, content, section_type, bid_workspace_id")
    .eq("workspace_id", workspaceId)
    .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    .limit(4);

  for (const p of proposals ?? []) {
    const oppId = bwToOppMap.get(p.bid_workspace_id) || "";
    results.push({
      id: p.id,
      type: "proposal_section",
      title: p.title,
      excerpt: excerpt(p.content, q),
      url: oppId ? `/tenders/${oppId}/workspace` : "/tenders",
      badge: p.section_type ?? undefined,
    });
  }

  // 4. Search knowledge documents
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id, title, extracted_text, category")
    .eq("workspace_id", workspaceId)
    .or(`title.ilike.%${q}%,extracted_text.ilike.%${q}%`)
    .limit(4);

  for (const d of docs ?? []) {
    results.push({
      id: d.id,
      type: "evidence",
      title: d.title,
      excerpt: excerpt(d.extracted_text, q),
      url: `/knowledge`,
      badge: d.category ?? undefined,
    });
  }

  // 5. Search compliance findings
  const { data: findings } = await supabase
    .from("compliance_findings")
    .select("id, requirement, problem, recommended_fix, severity, audit_id")
    .eq("workspace_id", workspaceId)
    .or(`requirement.ilike.%${q}%,problem.ilike.%${q}%`)
    .limit(4);

  if (findings && findings.length > 0) {
    // Map audit_id -> bid_workspace_id
    const auditIds = Array.from(new Set(findings.map((f) => f.audit_id)));
    const { data: audits } = await supabase
      .from("compliance_audits")
      .select("id, bid_workspace_id")
      .in("id", auditIds);

    const auditToBwMap = new Map<string, string>();
    for (const a of audits ?? []) {
      auditToBwMap.set(a.id, a.bid_workspace_id);
    }

    for (const f of findings) {
      const bwId = auditToBwMap.get(f.audit_id);
      const oppId = bwId ? bwToOppMap.get(bwId) : undefined;
      results.push({
        id: f.id,
        type: "compliance_finding",
        title: `Compliance: ${f.problem ? f.problem.slice(0, 60) : f.requirement.slice(0, 60)}`,
        excerpt: excerpt(f.recommended_fix || f.problem || f.requirement, q),
        url: oppId ? `/tenders/${oppId}/workspace` : "/tenders",
        badge: f.severity ?? undefined,
      });
    }
  }

  // 6. Search tasks
  const { data: tasks } = await supabase
    .from("bid_tasks")
    .select("id, title, description, priority, status, bid_workspace_id")
    .eq("workspace_id", workspaceId)
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(4);

  for (const t of tasks ?? []) {
    const oppId = bwToOppMap.get(t.bid_workspace_id);
    results.push({
      id: t.id,
      type: "task",
      title: t.title,
      excerpt: excerpt(t.description, q),
      url: oppId ? `/tenders/${oppId}/workspace` : "/tenders",
      badge: t.priority ?? undefined,
    });
  }

  return results.slice(0, limit);
}
