-- Migration: 20260911120000_security_audit_hardening.sql
-- 1. Prevent privilege escalation on profiles.is_platform_admin
-- 2. Drop plaintext temporary_password from workspace_invitations
-- 3. Enforce email verification in accept_invitation_by_token

-- 1. Trigger to protect is_platform_admin from unauthorized updates
CREATE OR REPLACE FUNCTION public.protect_profiles_admin_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent modifying is_platform_admin unless executing as service_role
  IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Only service_role can modify platform administrator status.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profiles_admin_escalation ON public.profiles;
CREATE TRIGGER tr_protect_profiles_admin_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_admin_escalation();

-- 2. Completely remove plaintext temporary_password column from workspace_invitations
ALTER TABLE public.workspace_invitations
  DROP COLUMN IF EXISTS temporary_password;

-- 3. Update accept_invitation_by_token to strictly enforce account email matching
CREATE OR REPLACE FUNCTION public.accept_invitation_by_token(
  _token TEXT,
  _user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.workspace_invitations%ROWTYPE;
  v_ws_name TEXT;
  v_caller_email TEXT;
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

  -- Verify caller identity: caller email MUST match invitation email
  SELECT email INTO v_caller_email FROM auth.users WHERE id = _user_id;
  IF v_caller_email IS NULL OR LOWER(v_caller_email) <> LOWER(v_inv.email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ACCOUNT_MISMATCH',
      'message', 'This invitation was issued to ' || v_inv.email || '. Please sign in with the invited email address.'
    );
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
