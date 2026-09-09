-- Migration: Production Hardening Periods, Reconciled Billing, Proposal & Compliance Extensions

-- 1. Subscription & Authoritative Period Tracking on workspaces
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS renewal_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Period-scoped Usage Records
ALTER TABLE public.usage_records
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan TEXT;

CREATE INDEX IF NOT EXISTS idx_usage_records_period 
  ON public.usage_records(workspace_id, operation, created_at);

-- 3. Extend Compliance Findings Severity & Status
DO $$
BEGIN
  ALTER TYPE public.finding_severity ADD VALUE IF NOT EXISTS 'high';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.finding_severity ADD VALUE IF NOT EXISTS 'medium';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.finding_severity ADD VALUE IF NOT EXISTS 'low';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.compliance_findings
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open' 
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'waived')),
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'mandatory_requirement';

-- 4. Proposal Documents Structure & Evidence Linkage
ALTER TABLE public.proposal_documents
  ADD COLUMN IF NOT EXISTS section_type TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS requirement_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS evidence_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completeness_status TEXT NOT NULL DEFAULT 'draft';

-- 5. Submissions Package & Execution Metadata
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS submission_method TEXT DEFAULT 'portal',
  ADD COLUMN IF NOT EXISTS submission_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_files JSONB DEFAULT '[]'::jsonb;

-- 6. Bid Outcomes Disqualification & User Score
ALTER TABLE public.bid_outcomes
  ADD COLUMN IF NOT EXISTS disqualification_reason TEXT,
  ADD COLUMN IF NOT EXISTS user_score NUMERIC(6,2);

-- 7. RECONCILIATION: Fix affected Starter / Paid subscriptions
-- Reconcile any workspace that has a paid plan with its actual transaction activation time
DO $$
DECLARE
  ws RECORD;
  latest_tx RECORD;
BEGIN
  FOR ws IN 
    SELECT id, plan, created_at, updated_at 
    FROM public.workspaces 
    WHERE plan != 'trial' AND current_period_start IS NULL
  LOOP
    SELECT * INTO latest_tx 
    FROM public.billing_transactions 
    WHERE workspace_id = ws.id AND status = 'successful' 
    ORDER BY activated_at DESC NULLS LAST, created_at DESC 
    LIMIT 1;

    IF latest_tx.id IS NOT NULL AND latest_tx.activated_at IS NOT NULL THEN
      UPDATE public.workspaces
      SET 
        subscription_started_at = latest_tx.activated_at,
        current_period_start = latest_tx.activated_at,
        current_period_end = latest_tx.activated_at + interval '1 month',
        renewal_date = latest_tx.activated_at + interval '1 month',
        subscription_status = 'active',
        updated_at = now()
      WHERE id = ws.id;

      -- Tag previous usage before activation as trial
      UPDATE public.usage_records
      SET plan = 'trial', period_start = ws.created_at, period_end = latest_tx.activated_at
      WHERE workspace_id = ws.id AND created_at < latest_tx.activated_at;

      -- Tag subsequent usage with the paid period
      UPDATE public.usage_records
      SET plan = ws.plan::text, period_start = latest_tx.activated_at, period_end = latest_tx.activated_at + interval '1 month'
      WHERE workspace_id = ws.id AND created_at >= latest_tx.activated_at;
    ELSE
      -- If no successful transaction record found, use updated_at as current period start
      UPDATE public.workspaces
      SET 
        subscription_started_at = ws.updated_at,
        current_period_start = ws.updated_at,
        current_period_end = ws.updated_at + interval '1 month',
        renewal_date = ws.updated_at + interval '1 month',
        subscription_status = 'active',
        updated_at = now()
      WHERE id = ws.id;
    END IF;
  END LOOP;
END $$;
