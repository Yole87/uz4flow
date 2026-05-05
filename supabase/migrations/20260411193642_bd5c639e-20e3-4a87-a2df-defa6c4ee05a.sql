ALTER TABLE public.flow_steps DROP CONSTRAINT IF EXISTS flow_steps_step_type_check;
ALTER TABLE public.flow_steps ADD CONSTRAINT flow_steps_step_type_check 
  CHECK (step_type = ANY (ARRAY['text','file','condition','block','end','tag','lane','active_message','random','delay','menu']));

ALTER TABLE public.flow_steps ADD COLUMN IF NOT EXISTS menu_config JSONB DEFAULT NULL;