
-- Recreate view without security_invoker to bypass the "deny all SELECT" RLS policy
-- Security is maintained via: security_barrier + WHERE filter by user's org
DROP VIEW IF EXISTS public.mcp_connections_safe;

CREATE VIEW public.mcp_connections_safe
WITH (security_barrier = true) AS
SELECT 
  id, 
  organization_id, 
  provider, 
  description,
  is_active, 
  scopes, 
  token_expiry,
  created_at, 
  updated_at,
  (access_token IS NOT NULL OR access_token_encrypted IS NOT NULL) AS has_access_token,
  (refresh_token IS NOT NULL OR refresh_token_encrypted IS NOT NULL) AS has_refresh_token
FROM mcp_connections
WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()));
