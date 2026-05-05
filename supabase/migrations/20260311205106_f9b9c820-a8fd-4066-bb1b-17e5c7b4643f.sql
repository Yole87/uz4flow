
-- Table: conversation evaluation configs (per org)
CREATE TABLE public.conversation_evaluation_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT false,
  silence_minutes integer DEFAULT 60,
  variables jsonb DEFAULT '[]',
  custom_prompt text,
  webhook_url text,
  webhook_method text DEFAULT 'POST',
  webhook_headers jsonb DEFAULT '{}',
  webhook_payload_template text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.conversation_evaluation_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org eval config"
  ON public.conversation_evaluation_configs FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can insert their org eval config"
  ON public.conversation_evaluation_configs FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can update their org eval config"
  ON public.conversation_evaluation_configs FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())))
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

-- Table: conversation evaluations (history)
CREATE TABLE public.conversation_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  extracted_data jsonb DEFAULT '{}',
  ai_summary text,
  webhook_status text,
  webhook_response jsonb,
  evaluated_at timestamptz DEFAULT now(),
  last_message_at_snapshot timestamptz
);

ALTER TABLE public.conversation_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org evaluations"
  ON public.conversation_evaluations FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can insert evaluations for their org"
  ON public.conversation_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

-- Service role needs insert access for cron function
CREATE POLICY "Service role can insert evaluations"
  ON public.conversation_evaluations FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can select eval configs"
  ON public.conversation_evaluation_configs FOR SELECT
  TO service_role
  USING (true);

-- Index for efficient cron queries
CREATE INDEX idx_conversation_evaluations_conv_snapshot
  ON public.conversation_evaluations (conversation_id, last_message_at_snapshot);

CREATE INDEX idx_conversation_evaluation_configs_enabled
  ON public.conversation_evaluation_configs (is_enabled) WHERE is_enabled = true;
