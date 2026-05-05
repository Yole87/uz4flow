
-- Make message-media bucket private
UPDATE storage.buckets SET public = false WHERE id = 'message-media';

-- Drop the old public access policy
DROP POLICY IF EXISTS "Message media is publicly accessible" ON storage.objects;

-- Allow authenticated users to SELECT media files belonging to their organization
CREATE POLICY "Org members can view their message media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
  )
);
