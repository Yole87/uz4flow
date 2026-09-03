DROP POLICY IF EXISTS form_images_org_insert ON storage.objects;
CREATE POLICY form_images_org_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'form-images'
  AND (
    public.is_admin_master()
    OR (storage.foldername(objects.name))[1] IN (
      SELECT f.id::text FROM public.uz_forms f
      WHERE f.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  )
);

DROP POLICY IF EXISTS form_images_org_update ON storage.objects;
CREATE POLICY form_images_org_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'form-images'
  AND (
    public.is_admin_master()
    OR (storage.foldername(objects.name))[1] IN (
      SELECT f.id::text FROM public.uz_forms f
      WHERE f.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  )
)
WITH CHECK (
  bucket_id = 'form-images'
  AND (
    public.is_admin_master()
    OR (storage.foldername(objects.name))[1] IN (
      SELECT f.id::text FROM public.uz_forms f
      WHERE f.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  )
);

DROP POLICY IF EXISTS form_images_org_delete ON storage.objects;
CREATE POLICY form_images_org_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'form-images'
  AND (
    public.is_admin_master()
    OR (storage.foldername(objects.name))[1] IN (
      SELECT f.id::text FROM public.uz_forms f
      WHERE f.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  )
);

DROP POLICY IF EXISTS form_uploads_public_insert ON storage.objects;
CREATE POLICY form_uploads_public_insert ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'form-uploads'
  AND COALESCE((metadata->>'size')::bigint, 0) <= 10485760
  AND EXISTS (
    SELECT 1 FROM public.uz_forms f
    WHERE f.organization_id::text = (storage.foldername(objects.name))[1]
      AND f.is_active = true
      AND f.is_deleted = false
  )
);