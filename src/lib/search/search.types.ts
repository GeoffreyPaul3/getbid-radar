export type SearchResultType =
  | "opportunity"
  | "requirement"
  | "proposal_section"
  | "compliance_finding"
  | "evidence"
  | "task";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  excerpt: string;
  url: string;
  badge?: string | undefined;
}
