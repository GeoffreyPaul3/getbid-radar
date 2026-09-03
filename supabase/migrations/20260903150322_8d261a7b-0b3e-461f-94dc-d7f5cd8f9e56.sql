
CREATE POLICY "workspace members read documents" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.is_member((storage.foldername(name))[1]::uuid));
CREATE POLICY "workspace members upload documents" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND public.can_write((storage.foldername(name))[1]::uuid));
CREATE POLICY "workspace members update documents" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND public.can_write((storage.foldername(name))[1]::uuid));
CREATE POLICY "workspace members delete documents" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND public.can_write((storage.foldername(name))[1]::uuid));
