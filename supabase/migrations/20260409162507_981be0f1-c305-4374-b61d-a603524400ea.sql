
-- ============================================================
-- 1. mcp_server_configs: Restrict all ops to owners only
-- ============================================================
DROP POLICY IF EXISTS "Members can view their org MCP server configs" ON public.mcp_server_configs;
DROP POLICY IF EXISTS "Members can insert their org MCP server configs" ON public.mcp_server_configs;
DROP POLICY IF EXISTS "Members can update their org MCP server configs" ON public.mcp_server_configs;
DROP POLICY IF EXISTS "Members can delete their org MCP server configs" ON public.mcp_server_configs;

CREATE POLICY "Owners can view their org MCP server configs"
  ON public.mcp_server_configs FOR SELECT TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can insert their org MCP server configs"
  ON public.mcp_server_configs FOR INSERT TO authenticated
  WITH CHECK (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can update their org MCP server configs"
  ON public.mcp_server_configs FOR UPDATE TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()))
  WITH CHECK (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can delete their org MCP server configs"
  ON public.mcp_server_configs FOR DELETE TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

-- ============================================================
-- 2. crm_openbot_config: Restrict all ops to owners only
-- ============================================================
DROP POLICY IF EXISTS "Members can view their org CRM config" ON public.crm_openbot_config;
DROP POLICY IF EXISTS "Members can insert their org CRM config" ON public.crm_openbot_config;
DROP POLICY IF EXISTS "Members can update their org CRM config" ON public.crm_openbot_config;
DROP POLICY IF EXISTS "Members can delete their org CRM config" ON public.crm_openbot_config;

CREATE POLICY "Owners can view their org CRM config"
  ON public.crm_openbot_config FOR SELECT TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can insert their org CRM config"
  ON public.crm_openbot_config FOR INSERT TO authenticated
  WITH CHECK (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can update their org CRM config"
  ON public.crm_openbot_config FOR UPDATE TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()))
  WITH CHECK (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can delete their org CRM config"
  ON public.crm_openbot_config FOR DELETE TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

-- ============================================================
-- 3. prospect_providers: Restrict all ops to owners only
-- ============================================================
DROP POLICY IF EXISTS "Members can view their org prospect providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Members can insert their org prospect providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Members can update their org prospect providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Members can delete their org prospect providers" ON public.prospect_providers;

CREATE POLICY "Owners can view their org prospect providers"
  ON public.prospect_providers FOR SELECT TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can insert their org prospect providers"
  ON public.prospect_providers FOR INSERT TO authenticated
  WITH CHECK (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can update their org prospect providers"
  ON public.prospect_providers FOR UPDATE TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()))
  WITH CHECK (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can delete their org prospect providers"
  ON public.prospect_providers FOR DELETE TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

-- ============================================================
-- 4. instances: Restrict base table to owners (members use instances_safe view)
-- ============================================================
DROP POLICY IF EXISTS "Members can view their org instances" ON public.instances;
DROP POLICY IF EXISTS "Members can insert their org instances" ON public.instances;
DROP POLICY IF EXISTS "Members can update their org instances" ON public.instances;
DROP POLICY IF EXISTS "Members can delete their org instances" ON public.instances;

CREATE POLICY "Owners can view their org instances"
  ON public.instances FOR SELECT TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can insert their org instances"
  ON public.instances FOR INSERT TO authenticated
  WITH CHECK (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can update their org instances"
  ON public.instances FOR UPDATE TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()))
  WITH CHECK (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can delete their org instances"
  ON public.instances FOR DELETE TO authenticated
  USING (is_admin_master() OR is_organization_owner(organization_id, auth.uid()));

-- ============================================================
-- 5. instagram_sessions: Add missing SELECT/INSERT/UPDATE policies
-- ============================================================
CREATE POLICY "Members can view their org instagram sessions"
  ON public.instagram_sessions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can insert their org instagram sessions"
  ON public.instagram_sessions FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can update their org instagram sessions"
  ON public.instagram_sessions FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())))
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
