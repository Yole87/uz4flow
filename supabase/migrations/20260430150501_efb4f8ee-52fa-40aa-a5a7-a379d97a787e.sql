-- =========================================================
-- 1) conversations.organization_id
-- =========================================================
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE public.conversations c
SET organization_id = ct.organization_id
FROM public.contacts ct
WHERE ct.id = c.contact_id
  AND c.organization_id IS NULL;

-- Abort se sobrar NULL (defesa)
DO $$
DECLARE v_nulls int;
BEGIN
  SELECT COUNT(*) INTO v_nulls FROM public.conversations WHERE organization_id IS NULL;
  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % conversations sem organization_id', v_nulls;
  END IF;
END $$;

ALTER TABLE public.conversations
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_organization_id
  ON public.conversations(organization_id);

-- Trigger BEFORE INSERT/UPDATE para auto-preencher
CREATE OR REPLACE FUNCTION public.set_conversation_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT ct.organization_id INTO NEW.organization_id
    FROM public.contacts ct WHERE ct.id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_conversation_organization_id ON public.conversations;
CREATE TRIGGER trg_set_conversation_organization_id
  BEFORE INSERT OR UPDATE OF contact_id ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_conversation_organization_id();

-- =========================================================
-- 2) Reescrever URLs legacy /object/public/message-media/...
-- =========================================================
UPDATE public.messages
SET media_url = regexp_replace(
  media_url,
  '/storage/v1/object/public/message-media/',
  '/storage/v1/object/message-media/'
)
WHERE media_url LIKE '%/storage/v1/object/public/message-media/%';

-- =========================================================
-- 3) Garantir bucket privado
-- =========================================================
UPDATE storage.buckets SET public = false WHERE id = 'message-media';

-- =========================================================
-- 4) Endurecer policies de Storage: substituir
--    get_user_organization_ids (que retorna todas orgs para
--    admin_master) por subquery direta em organization_members.
--    Acesso administrativo cross-tenant exige Modo Suporte (service_role).
-- =========================================================

-- quick-reply-media
DROP POLICY IF EXISTS "Members can read quick reply media" ON storage.objects;
CREATE POLICY "Members can read quick reply media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'quick-reply-media'
  AND ((split_part(name, '/', 1))::uuid IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Members can update quick reply media" ON storage.objects;
CREATE POLICY "Members can update quick reply media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'quick-reply-media'
  AND ((split_part(name, '/', 1))::uuid IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Members can delete quick reply media" ON storage.objects;
CREATE POLICY "Members can delete quick reply media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'quick-reply-media'
  AND ((split_part(name, '/', 1))::uuid IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
);

-- contact-attachments
DROP POLICY IF EXISTS "Org members can view contact attachments" ON storage.objects;
CREATE POLICY "Org members can view contact attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contact-attachments'
  AND auth.uid() IS NOT NULL
  AND (((storage.foldername(name))[1])::uuid IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Org members can delete contact attachments" ON storage.objects;
CREATE POLICY "Org members can delete contact attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contact-attachments'
  AND auth.uid() IS NOT NULL
  AND (((storage.foldername(name))[1])::uuid IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
);

-- flow-files
DROP POLICY IF EXISTS "flow-files org members select" ON storage.objects;
CREATE POLICY "flow-files org members select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'flow-files'
  AND (((storage.foldername(name))[1])::uuid IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "flow-files org members update" ON storage.objects;
CREATE POLICY "flow-files org members update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'flow-files'
  AND (((storage.foldername(name))[1])::uuid IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "flow-files org members delete" ON storage.objects;
CREATE POLICY "flow-files org members delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'flow-files'
  AND (((storage.foldername(name))[1])::uuid IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
);