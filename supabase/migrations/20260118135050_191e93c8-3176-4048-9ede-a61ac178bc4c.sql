-- Create auto_reengagement_config table
CREATE TABLE public.auto_reengagement_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  delay_minutes INTEGER NOT NULL DEFAULT 30,
  template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  custom_message TEXT,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(flow_id)
);

-- Create auto_reengagement_queue table
CREATE TABLE public.auto_reengagement_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.flow_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  config_id UUID NOT NULL REFERENCES public.auto_reengagement_config(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.auto_reengagement_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_reengagement_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for auto_reengagement_config
CREATE POLICY "Users can view their own configs"
ON public.auto_reengagement_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own configs"
ON public.auto_reengagement_config
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own configs"
ON public.auto_reengagement_config
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own configs"
ON public.auto_reengagement_config
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for auto_reengagement_queue
CREATE POLICY "Users can view their own queue items"
ON public.auto_reengagement_queue
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queue items"
ON public.auto_reengagement_queue
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue items"
ON public.auto_reengagement_queue
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own queue items"
ON public.auto_reengagement_queue
FOR DELETE
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_auto_reengagement_config_updated_at
BEFORE UPDATE ON public.auto_reengagement_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_auto_reengagement_queue_scheduled ON public.auto_reengagement_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_auto_reengagement_queue_session ON public.auto_reengagement_queue(session_id);
CREATE INDEX idx_auto_reengagement_config_flow ON public.auto_reengagement_config(flow_id);