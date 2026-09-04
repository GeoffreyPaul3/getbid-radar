alter table public.opportunity_requirements
  add column if not exists category text,
  add column if not exists source_page integer,
  add column if not exists source_section text,
  add column if not exists importance text not null default 'medium',
  add column if not exists extraction_confidence numeric,
  add column if not exists match_confidence numeric,
  add column if not exists is_ambiguous boolean not null default false,
  add column if not exists evidence_needed text,
  add column if not exists threshold_value text,
  add column if not exists due_date date,
  add column if not exists reasoning text,
  add column if not exists analysis_version integer,
  add column if not exists fingerprint text;

create unique index if not exists opportunity_requirements_fingerprint_key
  on public.opportunity_requirements (opportunity_id, fingerprint) where fingerprint is not null;

alter table public.score_components
  add column if not exists confidence numeric,
  add column if not exists blocking boolean not null default false;

alter table public.opportunity_analyses
  add column if not exists engine_version text,
  add column if not exists open_questions text[] not null default '{}',
  add column if not exists evidence_coverage numeric,
  add column if not exists inputs_fingerprint text;

create unique index if not exists opportunity_analyses_version_key
  on public.opportunity_analyses (opportunity_id, version);