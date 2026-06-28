
-- 1. Add owner column to analyses
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill from storage_path (oms/{uid}/{id}/...)
UPDATE public.analyses
SET user_id = (split_part(storage_path, '/', 1))::uuid
WHERE user_id IS NULL AND storage_path IS NOT NULL
  AND split_part(storage_path, '/', 1) ~ '^[0-9a-fA-F-]{36}$';

-- Delete legacy rows with no resolvable owner (cannot be safely attributed)
DELETE FROM public.analyses WHERE user_id IS NULL;

ALTER TABLE public.analyses
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 2. Replace permissive policies
DROP POLICY IF EXISTS "Anyone can view analyses" ON public.analyses;
DROP POLICY IF EXISTS "Anyone can insert analyses" ON public.analyses;
DROP POLICY IF EXISTS "Anyone can update analyses" ON public.analyses;

REVOKE ALL ON public.analyses FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.analyses TO authenticated;
GRANT ALL ON public.analyses TO service_role;

CREATE POLICY "Owners select own analyses"
  ON public.analyses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners insert own analyses"
  ON public.analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners update own analyses"
  ON public.analyses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Lock down storage buckets to owner folder (path: {uid}/...)
DROP POLICY IF EXISTS "Anyone can read oms" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload oms" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read reports" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload reports" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update reports" ON storage.objects;

CREATE POLICY "Owners read own oms"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'oms' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners upload own oms"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'oms' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners update own oms"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'oms' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'oms' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners read own reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners upload own reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners update own reports"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);
