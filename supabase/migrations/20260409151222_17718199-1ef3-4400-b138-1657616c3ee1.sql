
-- ============================================================
-- Fix 1: instagram_accounts - Restrict INSERT/UPDATE/DELETE to org owners only
-- ============================================================

-- Drop existing permissive member policies
DROP POLICY IF EXISTS "Members can insert their org instagram accounts" ON public.instagram_accounts;
DROP POLICY IF EXISTS "Members can update their org instagram accounts" ON public.instagram_accounts;
DROP POLICY IF EXISTS "Members can delete their org instagram accounts" ON public.instagram_accounts;

-- Recreate as owner-only policies (consistent with SELECT)
CREATE POLICY "Owners can insert their org instagram accounts"
  ON public.instagram_accounts FOR INSERT TO authenticated
  WITH CHECK (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can update their org instagram accounts"
  ON public.instagram_accounts FOR UPDATE TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()))
  WITH CHECK (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can delete their org instagram accounts"
  ON public.instagram_accounts FOR DELETE TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

-- ============================================================
-- Fix 2: instagram_leads - Add missing SELECT, INSERT, UPDATE policies
-- ============================================================

CREATE POLICY "Members can view their org instagram leads"
  ON public.instagram_leads FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can insert their org instagram leads"
  ON public.instagram_leads FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can update their org instagram leads"
  ON public.instagram_leads FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())))
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
