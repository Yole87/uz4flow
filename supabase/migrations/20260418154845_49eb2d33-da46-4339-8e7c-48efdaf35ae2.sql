
-- 1. Add media columns to quick_replies
ALTER TABLE public.quick_replies
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 2. Validation: media_type allowed values
CREATE OR REPLACE FUNCTION public.validate_quick_reply()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.media_type NOT IN ('text','audio','image','video','document') THEN
    RAISE EXCEPTION 'media_type must be text, audio, image, video or document';
  END IF;
  -- text requires content; media types require media_url
  IF NEW.media_type = 'text' AND (NEW.content IS NULL OR length(trim(NEW.content)) = 0) THEN
    RAISE EXCEPTION 'text quick reply requires content';
  END IF;
  IF NEW.media_type <> 'text' AND (NEW.media_url IS NULL OR length(trim(NEW.media_url)) = 0) THEN
    RAISE EXCEPTION 'media quick reply requires media_url';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quick_reply ON public.quick_replies;
CREATE TRIGGER trg_validate_quick_reply
BEFORE INSERT OR UPDATE ON public.quick_replies
FOR EACH ROW EXECUTE FUNCTION public.validate_quick_reply();

-- 3. Make content nullable for media types (default empty)
ALTER TABLE public.quick_replies ALTER COLUMN content DROP NOT NULL;

-- 4. Storage bucket for quick reply media (private, RLS enforced)
INSERT INTO storage.buckets (id, name, public)
VALUES ('quick-reply-media', 'quick-reply-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: org members can manage files inside their org folder
CREATE POLICY "Members can read quick reply media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'quick-reply-media'
  AND (split_part(name, '/', 1))::uuid IN (SELECT public.get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Members can upload quick reply media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'quick-reply-media'
  AND (split_part(name, '/', 1))::uuid IN (SELECT public.get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Members can delete quick reply media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'quick-reply-media'
  AND (split_part(name, '/', 1))::uuid IN (SELECT public.get_user_organization_ids(auth.uid()))
);

CREATE INDEX IF NOT EXISTS idx_quick_replies_org_type ON public.quick_replies(organization_id, media_type);
