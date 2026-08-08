-- 1. affiliate_settings: no anonymous read
DROP POLICY IF EXISTS "Public can read affiliate settings" ON public.affiliate_settings;
CREATE POLICY "Authenticated can read affiliate settings"
ON public.affiliate_settings FOR SELECT TO authenticated USING (true);

-- 2. affiliate_terms_versions: drop redundant public read + unrestricted insert
DROP POLICY IF EXISTS "terms_versions_public_read" ON public.affiliate_terms_versions;
DROP POLICY IF EXISTS "terms_versions_admin_insert" ON public.affiliate_terms_versions;

-- 3. Lock down EXECUTE on public functions
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_master() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_affiliate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organization_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organization_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_org_storage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_last_seen(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_affiliate_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_messages_agg(timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 4. quick-reply-media storage: authenticated only + validated uuid folder
DROP POLICY IF EXISTS "Members can read quick reply media" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload quick reply media" ON storage.objects;
DROP POLICY IF EXISTS "Members can update quick reply media" ON storage.objects;
DROP POLICY IF EXISTS "Members can delete quick reply media" ON storage.objects;

CREATE POLICY "Members can read quick reply media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'quick-reply-media'
  AND split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = split_part(name, '/', 1)::uuid
  )
);

CREATE POLICY "Members can upload quick reply media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'quick-reply-media'
  AND split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = split_part(name, '/', 1)::uuid
  )
);

CREATE POLICY "Members can update quick reply media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'quick-reply-media'
  AND split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = split_part(name, '/', 1)::uuid
  )
)
WITH CHECK (
  bucket_id = 'quick-reply-media'
  AND split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = split_part(name, '/', 1)::uuid
  )
);

CREATE POLICY "Members can delete quick reply media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'quick-reply-media'
  AND split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = split_part(name, '/', 1)::uuid
  )
);

-- 5. Audit every role assignment change (admin_master bypass accountability)
CREATE OR REPLACE FUNCTION public.audit_user_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
  VALUES (
    COALESCE(auth.uid(), COALESCE(NEW.user_id, OLD.user_id)),
    TG_OP || '_user_role',
    'user_roles',
    COALESCE(NEW.user_id, OLD.user_id)::text,
    jsonb_build_object(
      'old', CASE WHEN OLD IS NULL THEN NULL ELSE to_jsonb(OLD) END,
      'new', CASE WHEN NEW IS NULL THEN NULL ELSE to_jsonb(NEW) END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_role_changes ON public.user_roles;
CREATE TRIGGER trg_audit_user_role_changes
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_changes();