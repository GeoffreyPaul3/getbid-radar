-- ============================================================
-- Deadline reminder tracking columns on opportunities
-- ============================================================
-- Idempotency columns to prevent duplicate email alerts
-- ============================================================

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS reminder_7d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_3d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;
