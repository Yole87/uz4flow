
-- =============================================
-- 1. mcp_connections: Block direct SELECT, create safe view
-- =============================================
DROP POLICY IF EXISTS "Members can view their org MCP connections" ON mcp_connections;

CREATE POLICY "Deny direct SELECT on mcp_connections"
ON mcp_connections FOR SELECT
TO authenticated USING (false);

CREATE VIEW public.mcp_connections_safe
WITH (security_invoker = true) AS
SELECT id, organization_id, provider, description,
       is_active, scopes, token_expiry,
       created_at, updated_at,
       (access_token IS NOT NULL OR access_token_encrypted IS NOT NULL) AS has_access_token,
       (refresh_token IS NOT NULL OR refresh_token_encrypted IS NOT NULL) AS has_refresh_token
FROM mcp_connections;

-- =============================================
-- 2. crm_openbot_config: Restrict INSERT/UPDATE/DELETE to owners
-- =============================================
DROP POLICY IF EXISTS "Users can insert their org config" ON crm_openbot_config;
CREATE POLICY "Owners can insert their org config"
ON crm_openbot_config FOR INSERT
WITH CHECK (is_organization_owner(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update their org config" ON crm_openbot_config;
CREATE POLICY "Owners can update their org config"
ON crm_openbot_config FOR UPDATE
USING (is_organization_owner(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Users can delete their org config" ON crm_openbot_config;
CREATE POLICY "Owners can delete their org config"
ON crm_openbot_config FOR DELETE
USING (is_organization_owner(organization_id, auth.uid()));

-- =============================================
-- 3. prospect_providers: Restrict INSERT/UPDATE/DELETE to owners
-- =============================================
DROP POLICY IF EXISTS "Org members can delete their prospect providers" ON prospect_providers;
DROP POLICY IF EXISTS "Org members can insert prospect providers" ON prospect_providers;
DROP POLICY IF EXISTS "Org members can update their prospect providers" ON prospect_providers;
DROP POLICY IF EXISTS "Users can delete their organization providers" ON prospect_providers;
DROP POLICY IF EXISTS "Users can insert their organization providers" ON prospect_providers;
DROP POLICY IF EXISTS "Users can update their organization providers" ON prospect_providers;

CREATE POLICY "Owners can insert prospect providers"
ON prospect_providers FOR INSERT
WITH CHECK (is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can update their prospect providers"
ON prospect_providers FOR UPDATE
USING (is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can delete their prospect providers"
ON prospect_providers FOR DELETE
USING (is_organization_owner(organization_id, auth.uid()));
