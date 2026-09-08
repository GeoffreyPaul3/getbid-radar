-- Fix: Allow workspace creators to SELECT their workspace immediately upon creation
DROP POLICY IF EXISTS "ws read" ON public.workspaces;
CREATE POLICY "ws read" ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_member(id) OR created_by = auth.uid());
