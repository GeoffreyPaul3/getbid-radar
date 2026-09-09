-- Migration: 20260909093000_opportunity_requirements_fingerprint_unique.sql
-- Description: Fix opportunity_requirements unique constraint for ON CONFLICT (opportunity_id, fingerprint) upsert.
-- Root cause: The previous migration created a partial index with WHERE fingerprint IS NOT NULL, which PostgreSQL
-- rejects as a conflict target for ON CONFLICT (opportunity_id, fingerprint) without the matching WHERE predicate.

-- 1. Deduplicate any existing records with duplicate (opportunity_id, fingerprint) if any exist,
-- keeping the newest row by updated_at / created_at.
DELETE FROM public.opportunity_requirements
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY opportunity_id, fingerprint
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) as rn
    FROM public.opportunity_requirements
    WHERE fingerprint IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- 2. Drop the old partial index
DROP INDEX IF EXISTS public.opportunity_requirements_fingerprint_key;

-- 3. Drop constraint if it already exists (idempotency)
ALTER TABLE public.opportunity_requirements
  DROP CONSTRAINT IF EXISTS opportunity_requirements_opportunity_id_fingerprint_key;

-- 4. Add the unconditional table UNIQUE constraint matching ON CONFLICT (opportunity_id, fingerprint)
ALTER TABLE public.opportunity_requirements
  ADD CONSTRAINT opportunity_requirements_opportunity_id_fingerprint_key
  UNIQUE (opportunity_id, fingerprint);
