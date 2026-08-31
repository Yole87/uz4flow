DROP VIEW IF EXISTS public.mcp_connections_safe;

CREATE VIEW public.mcp_connections_safe AS
SELECT id,
       organization_id,
       provider,
       description,
       is_active,
       created_at,
       updated_at
FROM public.mcp_connections
WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()));

REVOKE ALL ON public.mcp_connections_safe FROM anon;
GRANT SELECT ON public.mcp_connections_safe TO authenticated;