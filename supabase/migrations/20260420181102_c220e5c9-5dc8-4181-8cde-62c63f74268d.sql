-- Add missing UPDATE policies for storage buckets so upsert (overwrite) works.
-- Without these, supabase.storage.upload(..., { upsert: true }) silently fails on existing keys.

-- flow-files: owner-scoped (first folder = user_id)
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'flow-files' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'flow-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- quick-reply-media: org-scoped (first folder = organization_id)
CREATE POLICY "Members can update quick reply media"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'quick-reply-media'
  AND (split_part(name, '/', 1))::uuid IN (
    SELECT get_user_organization_ids(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'quick-reply-media'
  AND (split_part(name, '/', 1))::uuid IN (
    SELECT get_user_organization_ids(auth.uid())
  )
);