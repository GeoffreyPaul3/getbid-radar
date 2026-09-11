-- Migration: 20260911100000_invitation_token.sql
-- Add a cryptographically secure, single-use token to workspace_invitations.
-- Add temporary_password column to workspace_invitations.
-- Add must_change_password column to profiles.
-- Update can_write to support 'member' role.
-- Add lookup_invitation_by_token and accept_invitation_by_token functions.

-- 1. Add token and temporary_password to workspace_invitations
ALTER TABLE public.workspace_invitations
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;

ALTER TABLE public.workspace_invitations
  ADD COLUMN IF NOT EXISTS temporary_password TEXT;

-- 2. Add must_change_password to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- 3. Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token
  ON public.workspace_invitations(token)
  WHERE token IS NOT NULL;

-- 4. Fix can_write function to include 'member' role
CREATE OR REPLACE FUNCTION public.can_write(_ws uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.member_role(_ws) IN ('owner','admin','member','bid_manager','contributor');
$function$;

-- 5. Create lookup_invitation_by_token function
CREATE OR REPLACE FUNCTION public.lookup_invitation_by_token(_token TEXT)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  workspace_name TEXT,
  email TEXT,
  full_name TEXT,
  role public.app_role,
  status TEXT,
  expires_at TIMESTAMPTZ,
  invited_by_name TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT
      wi.id,
      wi.workspace_id,
      w.name AS workspace_name,
      wi.email,
      wi.full_name,
      wi.role,
      wi.status,
      wi.expires_at,
      COALESCE(p.full_name, 'A workspace administrator') AS invited_by_name
    FROM public.workspace_invitations wi
    JOIN public.workspaces w ON w.id = wi.workspace_id
    LEFT JOIN public.profiles p ON p.id = wi.invited_by
    WHERE wi.token = _token
    LIMIT 1;
END; $$;

GRANT EXECUTE ON FUNCTION public.lookup_invitation_by_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_invitation_by_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_invitation_by_token(TEXT) TO service_role;

-- 6. Create accept_invitation_by_token function
CREATE OR REPLACE FUNCTION public.accept_invitation_by_token(
  _token TEXT,
  _user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.workspace_invitations%ROWTYPE;
  v_ws_name TEXT;
BEGIN
  SELECT * INTO v_inv
  FROM public.workspace_invitations
  WHERE token = _token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TOKEN', 'message', 'Invitation not found or link has already been used.');
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ACCEPTED', 'message', 'This invitation has already been accepted.');
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE public.workspace_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN jsonb_build_object('success', false, 'error', 'EXPIRED', 'message', 'This invitation link has expired.');
  END IF;

  SELECT name INTO v_ws_name FROM public.workspaces WHERE id = v_inv.workspace_id;

  -- Add to workspace_members
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_inv.workspace_id, _user_id, v_inv.role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Ensure profile has name if empty
  UPDATE public.profiles
  SET
    full_name = COALESCE(full_name, v_inv.full_name),
    updated_at = now()
  WHERE id = _user_id AND (full_name IS NULL OR full_name = '');

  -- Mark accepted and clear token so it cannot be reused
  UPDATE public.workspace_invitations
  SET status = 'accepted', token = NULL
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', v_inv.workspace_id,
    'workspace_name', COALESCE(v_ws_name, 'Workspace'),
    'role', v_inv.role
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.accept_invitation_by_token(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation_by_token(TEXT, UUID) TO service_role;
