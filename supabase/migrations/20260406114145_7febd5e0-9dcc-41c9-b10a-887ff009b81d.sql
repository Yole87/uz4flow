-- Step 1: Clean up duplicate openbot_instance_id = 'default'
UPDATE public.instances 
SET openbot_instance_id = NULL 
WHERE openbot_instance_id = 'default';

-- Step 2: Create partial unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS instances_openbot_instance_id_unique 
ON public.instances (openbot_instance_id) 
WHERE openbot_instance_id IS NOT NULL;

-- Step 3: Fix mcp_connections_safe view to use security_invoker
DROP VIEW IF EXISTS public.mcp_connections_safe;
CREATE VIEW public.mcp_connections_safe 
WITH (security_invoker = true) AS
SELECT 
  id,
  organization_id,
  provider,
  description,
  is_active,
  created_at,
  updated_at
FROM public.mcp_connections;