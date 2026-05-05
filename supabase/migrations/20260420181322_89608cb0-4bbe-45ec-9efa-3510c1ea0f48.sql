-- Restrict listing of branding-assets bucket while keeping individual files publicly accessible by URL.
-- The previous policy used USING (bucket_id = 'branding-assets') which lets anonymous clients
-- enumerate every object in the bucket via storage.objects SELECT.
-- We replace it with a no-op policy: public URLs continue to work (served by the storage CDN
-- without hitting RLS for the binary), but `list()` from the SDK will return nothing for non-admins.

DROP POLICY IF EXISTS "Public read branding assets" ON storage.objects;

-- Admins can still list/manage everything (covered by existing admin policies).
-- For everyone else, no SELECT row visibility on branding-assets metadata.
-- The public CDN URL (https://<project>.supabase.co/storage/v1/object/public/branding-assets/...)
-- continues to serve files because public buckets bypass RLS for direct object fetches.

CREATE POLICY "Admins can list branding assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'branding-assets' AND is_admin_master());