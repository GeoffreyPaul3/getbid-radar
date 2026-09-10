-- ============================================================
-- Seed platform admin role for primary operator
-- ============================================================
-- Sets is_platform_admin = true for geofreypaul40@gmail.com
-- Idempotent and safe to run multiple times.
-- ============================================================

UPDATE public.profiles
SET is_platform_admin = true
WHERE lower(email) = 'geofreypaul40@gmail.com'
   OR id IN (
     SELECT id FROM auth.users WHERE lower(email) = 'geofreypaul40@gmail.com'
   );
