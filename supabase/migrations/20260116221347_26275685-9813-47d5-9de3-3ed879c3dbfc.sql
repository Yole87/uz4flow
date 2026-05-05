-- ================================================
-- OpenFlow Bridge Database Schema
-- ================================================

-- Profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Integrations table for OpenBot credentials
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  openbot_api_key_encrypted TEXT,
  openbot_api_key_masked TEXT,
  openbot_inbound_url TEXT,
  webhook_secret TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS for integrations
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integration"
  ON public.integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integration"
  ON public.integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integration"
  ON public.integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integration"
  ON public.integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Flows table
CREATE TABLE public.flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for flows
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own flows"
  ON public.flows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flows"
  ON public.flows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flows"
  ON public.flows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flows"
  ON public.flows FOR DELETE
  USING (auth.uid() = user_id);

-- Files table for uploaded files
CREATE TABLE public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for files
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own files"
  ON public.files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
  ON public.files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
  ON public.files FOR DELETE
  USING (auth.uid() = user_id);

-- Flow steps table
CREATE TABLE public.flow_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('text', 'file')),
  text_content TEXT,
  file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  delay_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for flow_steps
ALTER TABLE public.flow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own flow steps"
  ON public.flow_steps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own flow steps"
  ON public.flow_steps FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own flow steps"
  ON public.flow_steps FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own flow steps"
  ON public.flow_steps FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid()
  ));

-- Routing rules table
CREATE TABLE public.routing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  match_type TEXT NOT NULL CHECK (match_type IN ('instance_id', 'keyword', 'fallback')),
  match_value TEXT,
  instance_id TEXT,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for routing_rules
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own routing rules"
  ON public.routing_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own routing rules"
  ON public.routing_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routing rules"
  ON public.routing_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own routing rules"
  ON public.routing_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Events table for webhook logs
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  push_name TEXT,
  message_id TEXT NOT NULL,
  message_text TEXT,
  received_payload_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  chosen_flow_id UUID REFERENCES public.flows(id) ON DELETE SET NULL,
  chosen_rule_id UUID REFERENCES public.routing_rules(id) ON DELETE SET NULL,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = user_id);

-- Event actions table for step execution logs
CREATE TABLE public.event_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.flow_steps(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,
  sent_payload_json JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  latency_ms INTEGER,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for event_actions
ALTER TABLE public.event_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own event actions"
  ON public.event_actions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.events WHERE events.id = event_actions.event_id AND events.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own event actions"
  ON public.event_actions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events WHERE events.id = event_actions.event_id AND events.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own event actions"
  ON public.event_actions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.events WHERE events.id = event_actions.event_id AND events.user_id = auth.uid()
  ));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_flows_updated_at
  BEFORE UPDATE ON public.flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_flow_steps_updated_at
  BEFORE UPDATE ON public.flow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_routing_rules_updated_at
  BEFORE UPDATE ON public.routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX idx_events_user_id_created_at ON public.events(user_id, created_at DESC);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_message_id ON public.events(user_id, instance_id, message_id);
CREATE INDEX idx_event_actions_event_id ON public.event_actions(event_id);
CREATE INDEX idx_flow_steps_flow_id ON public.flow_steps(flow_id, order_index);
CREATE INDEX idx_routing_rules_user_id ON public.routing_rules(user_id, priority DESC);

-- Create storage bucket for flow files
INSERT INTO storage.buckets (id, name, public) VALUES ('flow-files', 'flow-files', false);

-- Storage policies
CREATE POLICY "Users can view their own files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'flow-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'flow-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'flow-files' AND auth.uid()::text = (storage.foldername(name))[1]);