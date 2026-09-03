
REVOKE EXECUTE ON FUNCTION public.is_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.member_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
