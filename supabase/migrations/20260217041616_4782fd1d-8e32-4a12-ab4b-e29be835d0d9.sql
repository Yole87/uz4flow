
-- ============================================================
-- 1. Create a safe view for instances (excludes encrypted keys)
-- ============================================================
CREATE OR REPLACE VIEW public.instances_safe
WITH (security_invoker = false)
AS
SELECT
  id,
  organization_id,
  name,
  provider,
  phone_number,
  status,
  qr_code,
  webhook_url,
  api_url,
  openbot_instance_id,
  created_at,
  updated_at,
  (api_key_encrypted IS NOT NULL) AS has_api_key,
  (openbot_api_key_encrypted IS NOT NULL) AS has_openbot_api_key
FROM public.instances
WHERE organization_id IN (
  SELECT public.get_user_organization_ids(auth.uid())
);

-- ============================================================
-- 2. Restrict SELECT on base instances table (deny client access)
-- ============================================================
DROP POLICY IF EXISTS "Users can view their organization instances" ON public.instances;
CREATE POLICY "Deny direct SELECT on instances"
  ON public.instances FOR SELECT
  USING (false);

-- Keep INSERT/UPDATE/DELETE policies unchanged

-- ============================================================
-- 3. Restrict SELECT on crm_openbot_config (no client needs it)
-- ============================================================
DROP POLICY IF EXISTS "Users can view their org config" ON public.crm_openbot_config;
CREATE POLICY "Deny direct SELECT on crm_openbot_config"
  ON public.crm_openbot_config FOR SELECT
  USING (false);

-- Keep INSERT/UPDATE policies unchanged

-- ============================================================
-- 4. Restrict SELECT on prospect_providers (no client needs it)
-- ============================================================
DROP POLICY IF EXISTS "Org members can view their prospect providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Users can view their organization providers" ON public.prospect_providers;
CREATE POLICY "Deny direct SELECT on prospect_providers"
  ON public.prospect_providers FOR SELECT
  USING (false);

-- Keep INSERT/UPDATE/DELETE policies unchanged

-- ============================================================
-- 5. Grant SELECT on the safe view to authenticated users
-- ============================================================
GRANT SELECT ON public.instances_safe TO authenticated;
GRANT SELECT ON public.instances_safe TO anon;
