-- Migration: 20260909020001_workspace_members_and_invitations.sql
-- Description: Workspace member profile resolution, invitations table, and secure member management functions.

-- ============ WORKSPACE INVITATIONS ============
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_ws ON public.workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations(email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitations TO authenticated;
GRANT ALL ON public.workspace_invitations TO service_role;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- RLS: Members of workspace can view invitations; Admins/Owners can insert/update/delete
CREATE POLICY "wi select" ON public.workspace_invitations
  FOR SELECT TO authenticated
  USING (public.is_member(workspace_id));

CREATE POLICY "wi insert" ON public.workspace_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.can_admin(workspace_id));

CREATE POLICY "wi update" ON public.workspace_invitations
  FOR UPDATE TO authenticated
  USING (public.can_admin(workspace_id))
  WITH CHECK (public.can_admin(workspace_id));

CREATE POLICY "wi delete" ON public.workspace_invitations
  FOR DELETE TO authenticated
  USING (public.can_admin(workspace_id));

-- ============ AUTO-ACCEPT INVITATIONS ON USER SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 1. Create or update profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = now();

  -- 2. Auto-activate any pending workspace invitations for this email
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT wi.workspace_id, NEW.id, wi.role
  FROM public.workspace_invitations wi
  WHERE LOWER(wi.email) = LOWER(NEW.email)
    AND wi.status = 'pending'
    AND wi.expires_at > now()
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- 3. Mark invitations as accepted
  UPDATE public.workspace_invitations
  SET status = 'accepted'
  WHERE LOWER(email) = LOWER(NEW.email) AND status = 'pending';

  RETURN NEW;
END; $$;

-- ============ SECURE MEMBER DIRECTORY FUNCTION ============
-- Returns members and profile identity for a workspace. Enforces tenant isolation.
CREATE OR REPLACE FUNCTION public.get_workspace_member_directory(_workspace_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  role public.app_role,
  created_at TIMESTAMPTZ,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  is_pending BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Tenant isolation: Caller must be an active member of this workspace
  IF NOT public.is_member(_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;

  RETURN QUERY
    -- Active workspace members with profiles
    SELECT
      wm.id,
      wm.user_id,
      wm.role,
      wm.created_at,
      p.full_name,
      p.email,
      p.avatar_url,
      FALSE AS is_pending
    FROM public.workspace_members wm
    LEFT JOIN public.profiles p ON p.id = wm.user_id
    WHERE wm.workspace_id = _workspace_id

    UNION ALL

    -- Pending invitations
    SELECT
      wi.id,
      NULL::UUID AS user_id,
      wi.role,
      wi.created_at,
      wi.full_name,
      wi.email,
      NULL::TEXT AS avatar_url,
      TRUE AS is_pending
    FROM public.workspace_invitations wi
    WHERE wi.workspace_id = _workspace_id
      AND wi.status = 'pending'
      AND wi.expires_at > now()

    ORDER BY created_at ASC;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_workspace_member_directory(UUID) TO authenticated;
