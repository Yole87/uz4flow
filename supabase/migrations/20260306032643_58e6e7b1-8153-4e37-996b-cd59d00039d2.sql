
-- Create public branding-assets bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true);

-- Allow anyone to read from branding-assets (public bucket)
CREATE POLICY "Public read branding assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding-assets');

-- Only admin_master can upload/update/delete branding assets
CREATE POLICY "Admin upload branding assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding-assets'
  AND public.is_admin_master()
);

CREATE POLICY "Admin update branding assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding-assets'
  AND public.is_admin_master()
);

CREATE POLICY "Admin delete branding assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding-assets'
  AND public.is_admin_master()
);
