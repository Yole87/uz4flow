-- A. Update recalculate_org_storage to count 4 buckets
CREATE OR REPLACE FUNCTION public.recalculate_org_storage(p_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_bytes BIGINT := 0;
  v_total_files INTEGER := 0;
  v_b BIGINT;
  v_c INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND organization_id = p_org_id
    ) AND NOT public.is_admin_master() THEN
      RAISE EXCEPTION 'Access denied: not a member of this organization';
    END IF;
  END IF;

  -- message-media
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0), COUNT(*)
  INTO v_b, v_c FROM storage.objects
  WHERE bucket_id = 'message-media' AND name LIKE p_org_id::text || '/%';
  v_total_bytes := v_total_bytes + v_b; v_total_files := v_total_files + v_c;

  -- contact-attachments
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0), COUNT(*)
  INTO v_b, v_c FROM storage.objects
  WHERE bucket_id = 'contact-attachments' AND name LIKE p_org_id::text || '/%';
  v_total_bytes := v_total_bytes + v_b; v_total_files := v_total_files + v_c;

  -- flow-files
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0), COUNT(*)
  INTO v_b, v_c FROM storage.objects
  WHERE bucket_id = 'flow-files' AND name LIKE p_org_id::text || '/%';
  v_total_bytes := v_total_bytes + v_b; v_total_files := v_total_files + v_c;

  -- quick-reply-media
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0), COUNT(*)
  INTO v_b, v_c FROM storage.objects
  WHERE bucket_id = 'quick-reply-media' AND name LIKE p_org_id::text || '/%';
  v_total_bytes := v_total_bytes + v_b; v_total_files := v_total_files + v_c;

  INSERT INTO public.organization_storage_usage (organization_id, used_bytes, file_count, last_calculated_at)
  VALUES (p_org_id, v_total_bytes, v_total_files, now())
  ON CONFLICT (organization_id)
  DO UPDATE SET
    used_bytes = EXCLUDED.used_bytes,
    file_count = EXCLUDED.file_count,
    last_calculated_at = EXCLUDED.last_calculated_at;
END;
$function$;

-- B. Drop existing flow-files policies and recreate by organization
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname ILIKE '%flow-files%' OR policyname ILIKE '%flow_files%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "flow-files org members select" ON storage.objects;
DROP POLICY IF EXISTS "flow-files org members insert" ON storage.objects;
DROP POLICY IF EXISTS "flow-files org members update" ON storage.objects;
DROP POLICY IF EXISTS "flow-files org members delete" ON storage.objects;

CREATE POLICY "flow-files org members select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'flow-files'
  AND (
    public.is_admin_master()
    OR ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "flow-files org members insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'flow-files'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_organization_ids(auth.uid()))
);

CREATE POLICY "flow-files org members update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'flow-files'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_organization_ids(auth.uid()))
);

CREATE POLICY "flow-files org members delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'flow-files'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_organization_ids(auth.uid()))
);