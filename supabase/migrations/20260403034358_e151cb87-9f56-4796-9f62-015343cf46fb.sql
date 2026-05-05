CREATE POLICY "Public can read public settings"
ON public.saas_settings
FOR SELECT
TO anon, authenticated
USING (key IN ('landing_page', 'general', 'branding'));