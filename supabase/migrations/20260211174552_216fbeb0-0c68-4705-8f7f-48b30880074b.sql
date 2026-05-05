
-- Add voice_call to message_content_type enum
ALTER TYPE message_content_type ADD VALUE IF NOT EXISTS 'voice_call';

-- Add Vapi columns to crm_openbot_config
ALTER TABLE public.crm_openbot_config
  ADD COLUMN IF NOT EXISTS vapi_api_key_encrypted text,
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id text,
  ADD COLUMN IF NOT EXISTS vapi_default_voice text DEFAULT 'pt-BR-female';

-- Create voice_calls table
CREATE TABLE public.voice_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  contact_id uuid NOT NULL REFERENCES public.contacts(id),
  conversation_id uuid REFERENCES public.conversations(id),
  campaign_id uuid,
  vapi_call_id text,
  call_type text NOT NULL DEFAULT 'conversational',
  status text NOT NULL DEFAULT 'pending',
  duration_seconds integer,
  cost_cents integer,
  transcript text,
  summary text,
  recording_url text,
  script_content text,
  assistant_config jsonb DEFAULT '{}'::jsonb,
  ended_reason text,
  customer_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create voice_campaigns table
CREATE TABLE public.voice_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  call_type text NOT NULL DEFAULT 'conversational',
  assistant_config jsonb DEFAULT '{}'::jsonb,
  script_content text,
  status text NOT NULL DEFAULT 'draft',
  total_contacts integer NOT NULL DEFAULT 0,
  completed_calls integer NOT NULL DEFAULT 0,
  failed_calls integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK from voice_calls to voice_campaigns
ALTER TABLE public.voice_calls
  ADD CONSTRAINT voice_calls_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.voice_campaigns(id);

-- Create voice_campaign_contacts table
CREATE TABLE public.voice_campaign_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.voice_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id),
  voice_call_id uuid REFERENCES public.voice_calls(id),
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_campaign_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for voice_calls
CREATE POLICY "Users can view their org voice calls"
  ON public.voice_calls FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their org voice calls"
  ON public.voice_calls FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can update their org voice calls"
  ON public.voice_calls FOR UPDATE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their org voice calls"
  ON public.voice_calls FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- RLS policies for voice_campaigns
CREATE POLICY "Users can view their org voice campaigns"
  ON public.voice_campaigns FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their org voice campaigns"
  ON public.voice_campaigns FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can update their org voice campaigns"
  ON public.voice_campaigns FOR UPDATE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their org voice campaigns"
  ON public.voice_campaigns FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- RLS policies for voice_campaign_contacts (via campaign's org)
CREATE POLICY "Users can view their org campaign contacts"
  ON public.voice_campaign_contacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM voice_campaigns vc
    WHERE vc.id = voice_campaign_contacts.campaign_id
    AND vc.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can insert their org campaign contacts"
  ON public.voice_campaign_contacts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM voice_campaigns vc
    WHERE vc.id = voice_campaign_contacts.campaign_id
    AND vc.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can update their org campaign contacts"
  ON public.voice_campaign_contacts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM voice_campaigns vc
    WHERE vc.id = voice_campaign_contacts.campaign_id
    AND vc.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can delete their org campaign contacts"
  ON public.voice_campaign_contacts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM voice_campaigns vc
    WHERE vc.id = voice_campaign_contacts.campaign_id
    AND vc.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

-- Triggers for updated_at
CREATE TRIGGER update_voice_calls_updated_at
  BEFORE UPDATE ON public.voice_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_voice_campaigns_updated_at
  BEFORE UPDATE ON public.voice_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for voice_calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_calls;
