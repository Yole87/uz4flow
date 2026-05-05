-- Add instance_id column to conversation_evaluation_configs
ALTER TABLE public.conversation_evaluation_configs 
  ADD COLUMN instance_id uuid REFERENCES public.instances(id) ON DELETE CASCADE;

-- Drop old unique constraint on organization_id only
ALTER TABLE public.conversation_evaluation_configs 
  DROP CONSTRAINT IF EXISTS conversation_evaluation_configs_organization_id_key;

-- Create new unique constraint allowing one config per org+instance pair
-- NULL instance_id = global/fallback config for the org
ALTER TABLE public.conversation_evaluation_configs 
  ADD CONSTRAINT conversation_evaluation_configs_org_instance_unique 
  UNIQUE (organization_id, instance_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_eval_configs_instance 
  ON public.conversation_evaluation_configs(instance_id) 
  WHERE instance_id IS NOT NULL;