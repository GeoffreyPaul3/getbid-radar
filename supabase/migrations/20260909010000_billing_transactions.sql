-- Migration: Create billing_transactions table for PayChangu auditability and subscription activation
CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tx_ref TEXT NOT NULL UNIQUE,
  plan public.plan_tier NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('MWK', 'USD')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'cancelled', 'verification_failed')),
  provider_status TEXT,
  provider_tx_id TEXT,
  failure_reason TEXT,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_ws ON public.billing_transactions(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_tx_ref ON public.billing_transactions(tx_ref);

-- Row Level Security
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_transactions TO authenticated;
GRANT ALL ON public.billing_transactions TO service_role;

DROP POLICY IF EXISTS "member read" ON public.billing_transactions;
CREATE POLICY "member read" ON public.billing_transactions FOR SELECT TO authenticated 
  USING (public.is_member(workspace_id));

DROP POLICY IF EXISTS "member insert" ON public.billing_transactions;
CREATE POLICY "member insert" ON public.billing_transactions FOR INSERT TO authenticated 
  WITH CHECK (public.can_write(workspace_id));

DROP POLICY IF EXISTS "admin update" ON public.billing_transactions;
CREATE POLICY "admin update" ON public.billing_transactions FOR UPDATE TO authenticated 
  USING (public.can_admin(workspace_id)) WITH CHECK (public.can_admin(workspace_id));

DROP POLICY IF EXISTS "owner delete" ON public.billing_transactions;
CREATE POLICY "owner delete" ON public.billing_transactions FOR DELETE TO authenticated 
  USING (public.member_role(workspace_id) = 'owner');
