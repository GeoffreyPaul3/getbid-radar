-- ============================================================
-- Create the "avatars" storage bucket
-- ============================================================
-- Stores user avatar images.
-- Object path: {user_id}/{filename}
-- Allowed mime types: jpeg, png, webp. Size limit: 5MB.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload/update/delete their own avatar in their folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users manage own avatar'
  ) THEN
    CREATE POLICY "Users manage own avatar" ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
      WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone read avatars'
  ) THEN
    CREATE POLICY "Anyone read avatars" ON storage.objects
      FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;
END $$;
