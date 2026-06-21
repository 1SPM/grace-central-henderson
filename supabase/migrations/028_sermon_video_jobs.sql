-- GRACE CRM — AI sermon video generation jobs
-- Migration: 028_sermon_video_jobs.sql
--
-- Tracks Gemini/Veo long-running video generation jobs and stores completed
-- MP4 outputs in Supabase Storage under the sermon-videos bucket.

-- ============================================
-- 1. Storage bucket
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sermon-videos',
  'sermon-videos',
  false,
  104857600,
  ARRAY['video/mp4']
)
ON CONFLICT (id) DO UPDATE
SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============================================
-- 2. sermon_video_jobs
-- ============================================

CREATE TABLE IF NOT EXISTS sermon_video_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  created_by_clerk_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  operation_name TEXT,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  model TEXT NOT NULL DEFAULT 'veo-3.1-fast-generate-preview',
  aspect_ratio TEXT NOT NULL DEFAULT '16:9'
    CHECK (aspect_ratio IN ('16:9', '9:16')),
  resolution TEXT NOT NULL DEFAULT '720p'
    CHECK (resolution IN ('720p', '1080p')),
  duration_seconds INTEGER NOT NULL DEFAULT 8
    CHECK (duration_seconds IN (4, 6, 8)),
  storage_path TEXT,
  video_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sermon_video_jobs_church_time
  ON sermon_video_jobs(church_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sermon_video_jobs_operation
  ON sermon_video_jobs(operation_name)
  WHERE operation_name IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON sermon_video_jobs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sermon_video_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE sermon_video_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sermon_video_jobs read own church" ON sermon_video_jobs;
CREATE POLICY "sermon_video_jobs read own church"
  ON sermon_video_jobs FOR SELECT
  USING (church_id = public.get_church_id());

-- Writes happen through trusted server routes using the service role.

-- ============================================
-- 3. Storage object access
-- ============================================

DROP POLICY IF EXISTS "sermon videos read own church" ON storage.objects;
CREATE POLICY "sermon videos read own church"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sermon-videos'
    AND (storage.foldername(name))[1] = (SELECT public.get_church_id())::TEXT
  );

COMMENT ON TABLE sermon_video_jobs IS
  'Gemini/Veo sermon video generation jobs; outputs are uploaded to Supabase Storage in sermon-videos/{church_id}/{job_id}/video.mp4.';
