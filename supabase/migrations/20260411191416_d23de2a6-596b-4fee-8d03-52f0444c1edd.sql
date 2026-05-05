-- Update step_type check constraint to include active_message
ALTER TABLE public.flow_steps DROP CONSTRAINT IF EXISTS flow_steps_step_type_check;
ALTER TABLE public.flow_steps ADD CONSTRAINT flow_steps_step_type_check 
  CHECK (step_type = ANY (ARRAY['text','file','condition','block','end','tag','lane','active_message']));

-- Add active_message_config column
ALTER TABLE public.flow_steps ADD COLUMN IF NOT EXISTS active_message_config JSONB DEFAULT NULL;