-- 1) Function: sync integrations row from instances
CREATE OR REPLACE FUNCTION public.sync_integration_from_instance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_user_id uuid;
BEGIN
  IF NEW.openbot_api_key_encrypted IS NULL OR length(NEW.openbot_api_key_encrypted) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT owner_user_id INTO v_owner_user_id
  FROM public.organizations
  WHERE id = NEW.organization_id;

  IF v_owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.integrations (
    user_id,
    openbot_api_key_encrypted,
    webhook_secret
  ) VALUES (
    v_owner_user_id,
    NEW.openbot_api_key_encrypted,
    encode(gen_random_bytes(24), 'hex')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    openbot_api_key_encrypted = EXCLUDED.openbot_api_key_encrypted,
    webhook_secret = COALESCE(public.integrations.webhook_secret, EXCLUDED.webhook_secret),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 2) Trigger on instances
DROP TRIGGER IF EXISTS trg_sync_integration_from_instance ON public.instances;
CREATE TRIGGER trg_sync_integration_from_instance
AFTER INSERT OR UPDATE OF openbot_api_key_encrypted ON public.instances
FOR EACH ROW
EXECUTE FUNCTION public.sync_integration_from_instance();

-- 3) Backfill existing owners
INSERT INTO public.integrations (user_id, openbot_api_key_encrypted, webhook_secret)
SELECT DISTINCT ON (o.owner_user_id)
  o.owner_user_id,
  i.openbot_api_key_encrypted,
  encode(gen_random_bytes(24), 'hex')
FROM public.instances i
JOIN public.organizations o ON o.id = i.organization_id
WHERE i.openbot_api_key_encrypted IS NOT NULL
  AND length(i.openbot_api_key_encrypted) > 0
  AND o.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.integrations ig WHERE ig.user_id = o.owner_user_id
  )
ORDER BY o.owner_user_id, i.created_at DESC;
