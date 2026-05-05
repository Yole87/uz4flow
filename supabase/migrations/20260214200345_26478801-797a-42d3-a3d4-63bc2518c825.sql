
-- Table to cache storage usage per organization
CREATE TABLE public.organization_storage_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_storage_usage ENABLE ROW LEVEL SECURITY;

-- Members can read their own org usage
CREATE POLICY "Members can view their org storage usage"
  ON public.organization_storage_usage
  FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- Service role handles inserts/updates (no user policies for write)

-- Trigger for updated_at
CREATE TRIGGER update_org_storage_usage_updated_at
  BEFORE UPDATE ON public.organization_storage_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to recalculate storage for an organization
CREATE OR REPLACE FUNCTION public.recalculate_org_storage(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_bytes BIGINT := 0;
  v_total_files INTEGER := 0;
  v_media_bytes BIGINT := 0;
  v_media_files INTEGER := 0;
  v_attach_bytes BIGINT := 0;
  v_attach_files INTEGER := 0;
BEGIN
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
$$;

-- Enable realtime for storage usage updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_storage_usage;
