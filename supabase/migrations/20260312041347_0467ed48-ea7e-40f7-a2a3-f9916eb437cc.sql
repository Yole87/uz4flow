
-- 1. Fix CRITICAL: Remove self-serve INSERT policy on organization_members
-- This prevents any authenticated user from joining any organization
DROP POLICY IF EXISTS "Users can add themselves to organizations" ON public.organization_members;

-- 2. Fix WARNING: Restrict saas_settings SELECT to admin_master only
DROP POLICY IF EXISTS "Authenticated users can view saas settings" ON public.saas_settings;
CREATE POLICY "Only admins can view saas settings"
  ON public.saas_settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin_master());
