
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner','admin','bid_manager','contributor','viewer');
CREATE TYPE public.opportunity_status AS ENUM ('new','analyzing','analyzed','reviewing','pursuing','no_bid','preparing','submitted','won','lost','archived');
CREATE TYPE public.analysis_status AS ENUM ('queued','processing','completed','failed');
CREATE TYPE public.doc_status AS ENUM ('queued','processing','completed','failed');
CREATE TYPE public.recommendation AS ENUM ('bid','review','no_bid');
CREATE TYPE public.requirement_type AS ENUM ('eligibility','technical','financial','experience','certification','legal','documentation','delivery','commercial');
CREATE TYPE public.requirement_status AS ENUM ('pass','partial','missing','fail','needs_review');
CREATE TYPE public.task_status AS ENUM ('todo','in_progress','blocked','completed');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high','critical');
CREATE TYPE public.finding_severity AS ENUM ('critical','warning','passed');
CREATE TYPE public.submission_status AS ENUM ('preparing','ready_for_review','ready_to_submit','submitted','won','lost');
CREATE TYPE public.outcome_result AS ENUM ('won','lost','cancelled','disqualified');
CREATE TYPE public.plan_tier AS ENUM ('trial','starter','growth','pro');

-- ============ SHARED ============
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ WORKSPACES ============
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  plan public.plan_tier NOT NULL DEFAULT 'trial',
  subscription_status TEXT NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days',
  onboarding_step SMALLINT NOT NULL DEFAULT 1,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX idx_members_user ON public.workspace_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member(_ws UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = _ws AND m.user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.member_role(_ws UUID) RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM public.workspace_members m WHERE m.workspace_id = _ws AND m.user_id = auth.uid();
$$;
CREATE OR REPLACE FUNCTION public.can_write(_ws UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.member_role(_ws) IN ('owner','admin','bid_manager','contributor');
$$;
CREATE OR REPLACE FUNCTION public.can_admin(_ws UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.member_role(_ws) IN ('owner','admin');
$$;

CREATE POLICY "ws read" ON public.workspaces FOR SELECT TO authenticated USING (public.is_member(id));
CREATE POLICY "ws insert" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "ws update" ON public.workspaces FOR UPDATE TO authenticated USING (public.can_admin(id)) WITH CHECK (public.can_admin(id));
CREATE POLICY "ws delete" ON public.workspaces FOR DELETE TO authenticated USING (public.member_role(id) = 'owner');
CREATE TRIGGER t_ws_updated BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "wm read" ON public.workspace_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_member(workspace_id));
CREATE POLICY "wm insert" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.can_admin(workspace_id) OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.created_by = auth.uid()));
CREATE POLICY "wm update" ON public.workspace_members FOR UPDATE TO authenticated USING (public.can_admin(workspace_id)) WITH CHECK (public.can_admin(workspace_id));
CREATE POLICY "wm delete" ON public.workspace_members FOR DELETE TO authenticated USING (public.can_admin(workspace_id));

-- ============ COMPANY PROFILE ============
CREATE TABLE public.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  legal_name TEXT,
  website TEXT,
  country TEXT,
  address TEXT,
  description TEXT,
  industry TEXT,
  years_in_operation INTEGER,
  employee_count INTEGER,
  annual_turnover NUMERIC(16,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  min_contract_value NUMERIC(16,2),
  max_contract_value NUMERIC(16,2),
  preferred_contract_types TEXT[] NOT NULL DEFAULT '{}',
  preferred_industries TEXT[] NOT NULL DEFAULT '{}',
  preferred_regions TEXT[] NOT NULL DEFAULT '{}',
  excluded_industries TEXT[] NOT NULL DEFAULT '{}',
  excluded_regions TEXT[] NOT NULL DEFAULT '{}',
  geographic_coverage TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER t_cp_updated BEFORE UPDATE ON public.company_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.company_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'service',
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cap_ws ON public.company_capabilities(workspace_id);

CREATE TABLE public.company_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'certification',
  issuing_organization TEXT,
  reference_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cert_ws ON public.company_certifications(workspace_id);
CREATE TRIGGER t_cert_updated BEFORE UPDATE ON public.company_certifications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.company_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client TEXT,
  industry TEXT,
  location TEXT,
  contract_value NUMERIC(16,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  scope TEXT,
  services_delivered TEXT[] NOT NULL DEFAULT '{}',
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  reference_contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proj_ws ON public.company_projects(workspace_id);
CREATE TRIGGER t_proj_updated BEFORE UPDATE ON public.company_projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.company_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  project_id UUID REFERENCES public.company_projects(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ref_ws ON public.company_references(workspace_id);

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  years_experience INTEGER,
  skills TEXT[] NOT NULL DEFAULT '{}',
  certifications TEXT[] NOT NULL DEFAULT '{}',
  bio TEXT,
  document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_team_ws ON public.team_members(workspace_id);

-- ============ KNOWLEDGE BASE ============
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  status public.doc_status NOT NULL DEFAULT 'queued',
  error_message TEXT,
  page_count INTEGER,
  extracted_text TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kdoc_ws ON public.knowledge_documents(workspace_id);
CREATE TRIGGER t_kdoc_updated BEFORE UPDATE ON public.knowledge_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  section TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX idx_kchunk_ws ON public.knowledge_chunks(workspace_id);
CREATE INDEX idx_kchunk_fts ON public.knowledge_chunks USING gin (to_tsvector('english', content));

-- ============ OPPORTUNITIES ============
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  buyer TEXT,
  buyer_location TEXT,
  source_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'upload',
  contract_value NUMERIC(16,2),
  currency TEXT,
  deadline TIMESTAMPTZ,
  published_date DATE,
  description TEXT,
  scope TEXT,
  category TEXT,
  location TEXT,
  status public.opportunity_status NOT NULL DEFAULT 'new',
  analysis_status public.analysis_status NOT NULL DEFAULT 'queued',
  analysis_stage TEXT,
  analysis_error TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_opp_ws ON public.opportunities(workspace_id);
CREATE INDEX idx_opp_status ON public.opportunities(workspace_id, status);
CREATE INDEX idx_opp_deadline ON public.opportunities(workspace_id, deadline);
CREATE TRIGGER t_opp_updated BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.opportunity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT,
  source_url TEXT,
  mime_type TEXT,
  file_size BIGINT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  role TEXT NOT NULL DEFAULT 'tender',
  status public.doc_status NOT NULL DEFAULT 'queued',
  error_message TEXT,
  page_count INTEGER,
  char_count INTEGER,
  extracted_text TEXT,
  retrieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_odoc_opp ON public.opportunity_documents(opportunity_id);
CREATE TRIGGER t_odoc_updated BEFORE UPDATE ON public.opportunity_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.opportunity_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status public.analysis_status NOT NULL DEFAULT 'queued',
  bidradar_score INTEGER,
  recommendation public.recommendation,
  confidence NUMERIC(4,3),
  winability TEXT,
  estimated_effort_hours_min INTEGER,
  estimated_effort_hours_max INTEGER,
  executive_summary TEXT,
  reasoning TEXT,
  positive_factors TEXT[] NOT NULL DEFAULT '{}',
  negative_factors TEXT[] NOT NULL DEFAULT '{}',
  critical_blockers TEXT[] NOT NULL DEFAULT '{}',
  required_actions TEXT[] NOT NULL DEFAULT '{}',
  strengths TEXT[] NOT NULL DEFAULT '{}',
  weaknesses TEXT[] NOT NULL DEFAULT '{}',
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_evidence TEXT[] NOT NULL DEFAULT '{}',
  evaluation_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_strategy TEXT,
  model TEXT,
  error_message TEXT,
  human_override public.recommendation,
  human_override_reason TEXT,
  human_override_by UUID,
  human_override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, version)
);
CREATE INDEX idx_analysis_opp ON public.opportunity_analyses(opportunity_id);
CREATE TRIGGER t_analysis_updated BEFORE UPDATE ON public.opportunity_analyses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.score_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES public.opportunity_analyses(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  weight NUMERIC(4,3) NOT NULL,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, key)
);

CREATE TABLE public.opportunity_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  requirement TEXT NOT NULL,
  req_type public.requirement_type NOT NULL DEFAULT 'technical',
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  status public.requirement_status NOT NULL DEFAULT 'needs_review',
  company_match TEXT,
  evidence TEXT,
  risk TEXT,
  source_document_id UUID REFERENCES public.opportunity_documents(id) ON DELETE SET NULL,
  source_reference TEXT,
  action_required TEXT,
  human_edited BOOLEAN NOT NULL DEFAULT false,
  human_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_req_opp ON public.opportunity_requirements(opportunity_id);
CREATE TRIGGER t_req_updated BEFORE UPDATE ON public.opportunity_requirements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.evidence_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES public.opportunity_requirements(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.opportunity_analyses(id) ON DELETE CASCADE,
  origin TEXT NOT NULL DEFAULT 'company',
  label TEXT NOT NULL,
  excerpt TEXT,
  knowledge_document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE SET NULL,
  company_project_id UUID REFERENCES public.company_projects(id) ON DELETE SET NULL,
  certification_id UUID REFERENCES public.company_certifications(id) ON DELETE SET NULL,
  opportunity_document_id UUID REFERENCES public.opportunity_documents(id) ON DELETE SET NULL,
  source_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evi_req ON public.evidence_references(requirement_id);

-- ============ BID WORKSPACES ============
CREATE TABLE public.bid_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL UNIQUE REFERENCES public.opportunities(id) ON DELETE CASCADE,
  owner_id UUID,
  status public.submission_status NOT NULL DEFAULT 'preparing',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER t_bw_updated BEFORE UPDATE ON public.bid_workspaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.bid_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bid_workspace_id UUID NOT NULL REFERENCES public.bid_workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID,
  due_date DATE,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'todo',
  requirement_id UUID REFERENCES public.opportunity_requirements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_bw ON public.bid_tasks(bid_workspace_id);
CREATE TRIGGER t_task_updated BEFORE UPDATE ON public.bid_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.proposal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bid_workspace_id UUID NOT NULL REFERENCES public.bid_workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true,
  generated_by TEXT NOT NULL DEFAULT 'human',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prop_bw ON public.proposal_documents(bid_workspace_id);
CREATE TRIGGER t_prop_updated BEFORE UPDATE ON public.proposal_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ COMPLIANCE ============
CREATE TABLE public.compliance_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bid_workspace_id UUID NOT NULL REFERENCES public.bid_workspaces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status public.analysis_status NOT NULL DEFAULT 'queued',
  readiness_score INTEGER,
  summary TEXT,
  error_message TEXT,
  model TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_bw ON public.compliance_audits(bid_workspace_id);
CREATE TRIGGER t_audit_updated BEFORE UPDATE ON public.compliance_audits FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.compliance_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES public.compliance_audits(id) ON DELETE CASCADE,
  severity public.finding_severity NOT NULL,
  requirement TEXT NOT NULL,
  problem TEXT,
  evidence TEXT,
  recommended_fix TEXT,
  source_reference TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_finding_audit ON public.compliance_findings(audit_id);

-- ============ SUBMISSIONS & OUTCOMES ============
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bid_workspace_id UUID NOT NULL UNIQUE REFERENCES public.bid_workspaces(id) ON DELETE CASCADE,
  status public.submission_status NOT NULL DEFAULT 'preparing',
  submitted_at TIMESTAMPTZ,
  reference_number TEXT,
  bid_price NUMERIC(16,2),
  currency TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER t_sub_updated BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.bid_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL UNIQUE REFERENCES public.opportunities(id) ON DELETE CASCADE,
  result public.outcome_result NOT NULL,
  winning_company TEXT,
  winning_price NUMERIC(16,2),
  our_price NUMERIC(16,2),
  evaluation_score NUMERIC(6,2),
  feedback TEXT,
  loss_reason TEXT,
  lessons_learned TEXT,
  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outcome_ws ON public.bid_outcomes(workspace_id);

-- ============ PLATFORM ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_ws ON public.notifications(workspace_id, created_at DESC);

CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_log_ws ON public.activity_logs(workspace_id, created_at DESC);

CREATE TABLE public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id UUID,
  operation TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usage_ws ON public.usage_records(workspace_id, created_at DESC);

-- ============ RLS FOR WORKSPACE-SCOPED TABLES ============
DO $$
DECLARE t TEXT;
  tables TEXT[] := ARRAY[
    'company_profiles','company_capabilities','company_certifications','company_projects',
    'company_references','team_members','knowledge_documents','knowledge_chunks',
    'opportunities','opportunity_documents','opportunity_analyses','score_components',
    'opportunity_requirements','evidence_references','bid_workspaces','bid_tasks',
    'proposal_documents','compliance_audits','compliance_findings','submissions',
    'bid_outcomes','notifications','activity_logs','usage_records'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "member read" ON public.%I FOR SELECT TO authenticated USING (public.is_member(workspace_id))', t);
    EXECUTE format('CREATE POLICY "member insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write(workspace_id))', t);
    EXECUTE format('CREATE POLICY "member update" ON public.%I FOR UPDATE TO authenticated USING (public.can_write(workspace_id)) WITH CHECK (public.can_write(workspace_id))', t);
    EXECUTE format('CREATE POLICY "admin delete" ON public.%I FOR DELETE TO authenticated USING (public.can_write(workspace_id))', t);
  END LOOP;
END $$;

-- Audit/usage logs are append-only for members: block updates/deletes
DROP POLICY "member update" ON public.activity_logs;
DROP POLICY "admin delete" ON public.activity_logs;
DROP POLICY "member update" ON public.usage_records;
DROP POLICY "admin delete" ON public.usage_records;
DROP POLICY "member insert" ON public.activity_logs;
CREATE POLICY "member insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (public.is_member(workspace_id));
DROP POLICY "member insert" ON public.notifications;
CREATE POLICY "member insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_member(workspace_id));
DROP POLICY "member update" ON public.notifications;
CREATE POLICY "member update" ON public.notifications FOR UPDATE TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));
