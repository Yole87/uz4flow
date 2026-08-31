-- Recreate safe view honoring the caller's permissions
DROP VIEW IF EXISTS public.mcp_connections_safe;

CREATE VIEW public.mcp_connections_safe
WITH (security_invoker = true) AS
SELECT id,
       organization_id,
       provider,
       description,
       is_active,
       created_at,
       updated_at
FROM public.mcp_connections;

-- Replace the blanket deny with an org-scoped read policy
DROP POLICY IF EXISTS "Deny direct SELECT on mcp_connections" ON public.mcp_connections;

CREATE POLICY "Members can read their org MCP connections"
ON public.mcp_connections
FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

-- Column-level privileges keep tokens unreachable from the client
REVOKE SELECT ON public.mcp_connections FROM anon, authenticated;
GRANT SELECT (id, organization_id, provider, description, is_active, created_at, updated_at)
  ON public.mcp_connections TO authenticated;

REVOKE ALL ON public.mcp_connections_safe FROM anon;
GRANT SELECT ON public.mcp_connections_safe TO authenticated;