-- Migration: Add opportunity_id linkage to bid workspace tables
-- This allows proposal documents, compliance audits, findings, and submissions
-- to be queried directly by opportunity_id without requiring a bid_workspace join.

-- 1. proposal_documents: add opportunity_id
ALTER TABLE public.proposal_documents
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_prop_opp ON public.proposal_documents(opportunity_id);

-- Backfill from bid_workspaces
UPDATE public.proposal_documents pd
SET opportunity_id = bw.opportunity_id
FROM public.bid_workspaces bw
WHERE pd.bid_workspace_id = bw.id
  AND pd.opportunity_id IS NULL;

-- 2. compliance_audits: add opportunity_id
ALTER TABLE public.compliance_audits
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_audit_opp ON public.compliance_audits(opportunity_id);

UPDATE public.compliance_audits ca
SET opportunity_id = bw.opportunity_id
FROM public.bid_workspaces bw
WHERE ca.bid_workspace_id = bw.id
  AND ca.opportunity_id IS NULL;

-- 3. compliance_findings: add opportunity_id (for direct querying)
ALTER TABLE public.compliance_findings
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_finding_opp ON public.compliance_findings(opportunity_id);

UPDATE public.compliance_findings cf
SET opportunity_id = ca.opportunity_id
FROM public.compliance_audits ca
WHERE cf.audit_id = ca.id
  AND cf.opportunity_id IS NULL;

-- Also add the missing columns that our server code expects
ALTER TABLE public.compliance_findings
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS recommendation TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Migrate existing data: problem -> description, recommended_fix -> recommendation
UPDATE public.compliance_findings
SET description = problem, recommendation = recommended_fix
WHERE description IS NULL AND problem IS NOT NULL;

-- 4. submissions: add opportunity_id (unique per opportunity per workspace)
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_opp_ws
  ON public.submissions(opportunity_id, workspace_id)
  WHERE opportunity_id IS NOT NULL;

UPDATE public.submissions s
SET opportunity_id = bw.opportunity_id
FROM public.bid_workspaces bw
WHERE s.bid_workspace_id = bw.id
  AND s.opportunity_id IS NULL;

-- 5. bid_outcomes: add missing columns our server code uses
ALTER TABLE public.bid_outcomes
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS our_bid_price NUMERIC(16,2),
  ADD COLUMN IF NOT EXISTS buyer_feedback TEXT,
  ADD COLUMN IF NOT EXISTS disqualification_reason TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MWK',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill: result -> status, our_price -> our_bid_price, feedback -> buyer_feedback
UPDATE public.bid_outcomes
SET
  status = result::text,
  our_bid_price = our_price,
  buyer_feedback = feedback
WHERE status IS NULL;

-- 6. Add workspace_id unique constraint on bid_outcomes per opportunity
-- (already has UNIQUE on opportunity_id alone which covers this)

-- 7. Add bid_status to opportunities if missing
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS bid_status TEXT;
