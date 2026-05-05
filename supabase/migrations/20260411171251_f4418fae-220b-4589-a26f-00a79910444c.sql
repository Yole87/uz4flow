
ALTER TABLE public.flows
ADD COLUMN schedule_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN schedule_type text DEFAULT NULL,
ADD COLUMN schedule_config jsonb DEFAULT NULL;
