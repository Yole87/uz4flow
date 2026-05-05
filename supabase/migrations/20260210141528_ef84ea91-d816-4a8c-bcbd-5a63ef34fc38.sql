-- Fix contact-attachments storage policies: add org-based path isolation
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Org members can upload contact attachments" ON storage.objects;
DROP POLICY IF EXISTS "Org members can view contact attachments" ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete contact attachments" ON storage.objects;

-- Create org-scoped policies using path structure: /{org_id}/{contact_id}/{filename}
CREATE POLICY "Org members can upload contact attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contact-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT public.get_user_organization_ids(auth.uid())
  )
);

CREATE POLICY "Org members can view contact attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contact-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT public.get_user_organization_ids(auth.uid())
  )
);

CREATE POLICY "Org members can delete contact attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contact-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT public.get_user_organization_ids(auth.uid())
  )
);