
-- 1. Make message-media bucket private
UPDATE storage.buckets SET public = false WHERE id = 'message-media';

-- 2. Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Message media is publicly accessible" ON storage.objects;

-- 3. Create org-scoped SELECT policy: users can view media belonging to their organization
CREATE POLICY "Org members can view their media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- 4. Update INSERT policy to be org-scoped (drop old one first)
DROP POLICY IF EXISTS "Authenticated users can upload message media" ON storage.objects;

CREATE POLICY "Org members can upload their media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- 5. Add DELETE policy for org members (needed for cleanup)
DROP POLICY IF EXISTS "Org members can delete their media" ON storage.objects;

CREATE POLICY "Org members can delete their media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);
