
-- ============================================================
-- C1: Fix message-media storage policy (CRITICAL)
-- Remove the ALL policy with {public} role that grants full access
-- ============================================================
DROP POLICY IF EXISTS "Service role can manage message media" ON storage.objects;

-- ============================================================
-- C2: Fix organizations UPDATE policy (CRITICAL)
-- Protect is_active, blocked_at, block_reason from owner modification
-- ============================================================
DROP POLICY IF EXISTS "Owner can update their organization" ON public.organizations;

CREATE POLICY "Owner can update their organization"
ON public.organizations
FOR UPDATE
TO public
USING (owner_user_id = auth.uid())
WITH CHECK (
  owner_user_id = auth.uid()
  AND is_active IS NOT DISTINCT FROM (SELECT o.is_active FROM public.organizations o WHERE o.id = organizations.id)
  AND blocked_at IS NOT DISTINCT FROM (SELECT o.blocked_at FROM public.organizations o WHERE o.id = organizations.id)
  AND block_reason IS NOT DISTINCT FROM (SELECT o.block_reason FROM public.organizations o WHERE o.id = organizations.id)
);

-- ============================================================
-- C2b: Fix profiles UPDATE policy
-- Add WITH CHECK to prevent user_id change
-- ============================================================
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- M2: Revoke get_user_id_by_email from authenticated/anon
-- Only service_role should call this (prevents email enumeration)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email FROM authenticated, anon;

-- ============================================================
-- M4: Fix storage policies roles for contact-attachments
-- Change from {public} to {authenticated}
-- ============================================================
DROP POLICY IF EXISTS "Org members can view contact attachments" ON storage.objects;
CREATE POLICY "Org members can view contact attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contact-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organization_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Org members can upload contact attachments" ON storage.objects;
CREATE POLICY "Org members can upload contact attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contact-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organization_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Org members can delete contact attachments" ON storage.objects;
CREATE POLICY "Org members can delete contact attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'contact-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organization_ids(auth.uid()))
);

-- ============================================================
-- M4b: Fix storage policies roles for flow-files
-- Change from {public} to {authenticated}
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'flow-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'flow-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'flow-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
