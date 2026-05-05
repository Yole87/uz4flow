
-- Allow 'tag' as a valid step_type
ALTER TABLE public.flow_steps DROP CONSTRAINT IF EXISTS flow_steps_step_type_check;
ALTER TABLE public.flow_steps ADD CONSTRAINT flow_steps_step_type_check 
  CHECK (step_type = ANY (ARRAY['text','file','condition','block','end','tag']));

-- Add tag_config column
ALTER TABLE public.flow_steps ADD COLUMN IF NOT EXISTS tag_config JSONB DEFAULT NULL;
