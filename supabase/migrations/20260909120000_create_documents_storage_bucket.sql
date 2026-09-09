-- ============================================================
-- Create the private "documents" storage bucket
-- ============================================================
-- The bucket stores all workspace-scoped tender PDFs/documents.
-- It is intentionally private (public = false).
-- Object paths follow: {workspace_id}/tenders/{opportunity_id}/{filename}
-- The workspace prefix in the path is what the storage policies
-- (created in migration 20260903150322) use to enforce workspace isolation.
--
-- This INSERT is idempotent: it skips the row if the bucket already exists.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,              -- 50 MB per file
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/html',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;
