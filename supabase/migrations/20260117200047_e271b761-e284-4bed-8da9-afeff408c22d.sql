-- Create webhook_connectors table
CREATE TABLE public.webhook_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'custom',
  webhook_token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sample_payload JSONB,
  field_mappings JSONB,
  message_config JSONB,
  target_phone_field TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create connector_events table
CREATE TABLE public.connector_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES public.webhook_connectors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  received_payload JSONB NOT NULL,
  transformed_payload JSONB,
  generated_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  openbot_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for webhook_connectors
CREATE POLICY "Users can view their own connectors"
  ON public.webhook_connectors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connectors"
  ON public.webhook_connectors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connectors"
  ON public.webhook_connectors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connectors"
  ON public.webhook_connectors FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for connector_events
CREATE POLICY "Users can view their own connector events"
  ON public.connector_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connector events"
  ON public.connector_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connector events"
  ON public.connector_events FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_webhook_connectors_user_id ON public.webhook_connectors(user_id);
CREATE INDEX idx_webhook_connectors_token ON public.webhook_connectors(webhook_token);
CREATE INDEX idx_connector_events_connector_id ON public.connector_events(connector_id);
CREATE INDEX idx_connector_events_user_id ON public.connector_events(user_id);
CREATE INDEX idx_connector_events_created_at ON public.connector_events(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_webhook_connectors_updated_at
  BEFORE UPDATE ON public.webhook_connectors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for connector_events (for discovery mode)
ALTER PUBLICATION supabase_realtime ADD TABLE public.connector_events;