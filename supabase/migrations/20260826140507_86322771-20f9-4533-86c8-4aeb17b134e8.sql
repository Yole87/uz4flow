-- form-uploads: remove permissive cross-tenant policies
DROP POLICY IF EXISTS "form_uploads_read_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "form_uploads_delete_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "form_uploads_anyone_insert" ON storage.objects;
DROP POLICY IF EXISTS "form_uploads_insert_by_token" ON storage.objects;

-- Public insert scoped to a real organization folder that owns an active form
CREATE POLICY "form_uploads_public_insert"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'form-uploads'
  AND COALESCE((metadata ->> 'size')::bigint, 0) <= 10485760
  AND EXISTS (
    SELECT 1 FROM public.uz_forms f
    WHERE f.organization_id::text = (storage.foldername(name))[1]
      AND f.is_active = true
      AND f.is_deleted = false
  )
);

-- Org-scoped update on form-uploads
DROP POLICY IF EXISTS "form_uploads_org_update" ON storage.objects;
CREATE POLICY "form_uploads_org_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'form-uploads'
  AND (
    public.is_admin_master()
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.get_user_organization_ids(auth.uid()) AS id
    )
  )
)
WITH CHECK (
  bucket_id = 'form-uploads'
  AND (
    public.is_admin_master()
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.get_user_organization_ids(auth.uid()) AS id
    )
  )
);

-- form-images: replace permissive write policies with form/org ownership checks
DROP POLICY IF EXISTS "form_images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "form_images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "form_images_auth_delete" ON storage.objects;

CREATE POLICY "form_images_org_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'form-images'
  AND (
    public.is_admin_master()
    OR EXISTS (
      SELECT 1 FROM public.uz_forms f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.organization_id IN (
          SELECT id FROM public.get_user_organization_ids(auth.uid()) AS id
        )
    )
  )
);

CREATE POLICY "form_images_org_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'form-images'
  AND (
    public.is_admin_master()
    OR EXISTS (
      SELECT 1 FROM public.uz_forms f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.organization_id IN (
          SELECT id FROM public.get_user_organization_ids(auth.uid()) AS id
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'form-images'
  AND (
    public.is_admin_master()
    OR EXISTS (
      SELECT 1 FROM public.uz_forms f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.organization_id IN (
          SELECT id FROM public.get_user_organization_ids(auth.uid()) AS id
        )
    )
  )
);

CREATE POLICY "form_images_org_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'form-images'
  AND (
    public.is_admin_master()
    OR EXISTS (
      SELECT 1 FROM public.uz_forms f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.organization_id IN (
          SELECT id FROM public.get_user_organization_ids(auth.uid()) AS id
        )
    )
  )
);