
ALTER TABLE public.flow_steps DROP CONSTRAINT flow_steps_step_type_check;
ALTER TABLE public.flow_steps ADD CONSTRAINT flow_steps_step_type_check CHECK (step_type = ANY (ARRAY['text'::text, 'file'::text, 'condition'::text, 'block'::text, 'end'::text]));

ALTER TABLE public.flow_steps ADD COLUMN IF NOT EXISTS end_config JSONB DEFAULT NULL;
