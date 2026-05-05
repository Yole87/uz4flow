
CREATE OR REPLACE FUNCTION public.recalculate_org_storage(p_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_bytes BIGINT := 0;
  v_total_files INTEGER := 0;
  v_media_bytes BIGINT := 0;
  v_media_files INTEGER := 0;
  v_attach_bytes BIGINT := 0;
  v_attach_files INTEGER := 0;
BEGIN
  -- Access control: allow service role (auth.uid() is NULL) or org members only
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND organization_id = p_org_id
    ) THEN
      RAISE EXCEPTION 'Access denied: not a member of this organization';
    END IF;
  END IF;

  -- Count from message-media bucket
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0), COUNT(*)
  INTO v_media_bytes, v_media_files
  FROM storage.objects
  WHERE bucket_id = 'message-media'
    AND name LIKE p_org_id::text || '/%';

  -- Count from contact-attachments bucket
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0), COUNT(*)
  INTO v_attach_bytes, v_attach_files
  FROM storage.objects
  WHERE bucket_id = 'contact-attachments'
    AND name LIKE p_org_id::text || '/%';

  v_total_bytes := v_media_bytes + v_attach_bytes;
  v_total_files := v_media_files + v_attach_files;

  -- Upsert usage record
  INSERT INTO public.organization_storage_usage (organization_id, used_bytes, file_count, last_calculated_at)
  VALUES (p_org_id, v_total_bytes, v_total_files, now())
  ON CONFLICT (organization_id)
  DO UPDATE SET
    used_bytes = EXCLUDED.used_bytes,
    file_count = EXCLUDED.file_count,
    last_calculated_at = EXCLUDED.last_calculated_at;
END;
$function$;
