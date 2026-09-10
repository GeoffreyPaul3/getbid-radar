-- ============================================================
-- Platform admin gate for system-wide dashboard
-- ============================================================
-- Separates tenant/workspace roles from platform operator administration
-- ============================================================

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

-- Grant index for swift platform admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_platform_admin 
  ON public.profiles(is_platform_admin) 
  WHERE is_platform_admin = true;
