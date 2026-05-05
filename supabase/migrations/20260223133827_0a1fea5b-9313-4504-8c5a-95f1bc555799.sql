
-- =============================================
-- MÓDULO INSTAGRAM AUTOMATIONS - BLOCO 1
-- 8 tabelas novas, RLS, indexes, realtime
-- =============================================

-- 1. instagram_accounts
CREATE TABLE public.instagram_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ig_user_id text NOT NULL,
  page_id text NOT NULL,
  username text,
  profile_picture_url text,
  access_token_encrypted text NOT NULL,
  token_expires_at timestamptz,
  token_status text NOT NULL DEFAULT 'active',
  scopes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, ig_user_id)
);
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org instagram accounts" ON public.instagram_accounts FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram accounts" ON public.instagram_accounts FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram accounts" ON public.instagram_accounts FOR UPDATE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org instagram accounts" ON public.instagram_accounts FOR DELETE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE TRIGGER update_instagram_accounts_updated_at BEFORE UPDATE ON public.instagram_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. instagram_automations
CREATE TABLE public.instagram_automations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.instagram_accounts(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  trigger_type text NOT NULL,
  definition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution_count integer NOT NULL DEFAULT 0,
  last_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instagram_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org instagram automations" ON public.instagram_automations FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram automations" ON public.instagram_automations FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram automations" ON public.instagram_automations FOR UPDATE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org instagram automations" ON public.instagram_automations FOR DELETE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE TRIGGER update_instagram_automations_updated_at BEFORE UPDATE ON public.instagram_automations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. instagram_templates
CREATE TABLE public.instagram_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instagram_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org instagram templates" ON public.instagram_templates FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram templates" ON public.instagram_templates FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram templates" ON public.instagram_templates FOR UPDATE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org instagram templates" ON public.instagram_templates FOR DELETE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE TRIGGER update_instagram_templates_updated_at BEFORE UPDATE ON public.instagram_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. instagram_sessions
CREATE TABLE public.instagram_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES public.instagram_automations(id) ON DELETE SET NULL,
  ig_user_scoped_id text NOT NULL,
  current_step_index integer NOT NULL DEFAULT 0,
  context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instagram_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org instagram sessions" ON public.instagram_sessions FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram sessions" ON public.instagram_sessions FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram sessions" ON public.instagram_sessions FOR UPDATE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org instagram sessions" ON public.instagram_sessions FOR DELETE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE INDEX idx_instagram_sessions_active ON public.instagram_sessions (organization_id, ig_user_scoped_id) WHERE status = 'active';

CREATE TRIGGER update_instagram_sessions_updated_at BEFORE UPDATE ON public.instagram_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. instagram_leads
CREATE TABLE public.instagram_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ig_user_scoped_id text NOT NULL,
  ig_handle text,
  ig_name text,
  origin text,
  automation_id uuid REFERENCES public.instagram_automations(id) ON DELETE SET NULL,
  phone_normalized text,
  email text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'new',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, ig_user_scoped_id)
);
ALTER TABLE public.instagram_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org instagram leads" ON public.instagram_leads FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram leads" ON public.instagram_leads FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram leads" ON public.instagram_leads FOR UPDATE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org instagram leads" ON public.instagram_leads FOR DELETE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE TRIGGER update_instagram_leads_updated_at BEFORE UPDATE ON public.instagram_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. instagram_events
CREATE TABLE public.instagram_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.instagram_accounts(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_hash text UNIQUE,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received',
  error_message text
);
ALTER TABLE public.instagram_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org instagram events" ON public.instagram_events FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram events" ON public.instagram_events FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE INDEX idx_instagram_events_hash ON public.instagram_events (event_hash);
CREATE INDEX idx_instagram_events_org_status ON public.instagram_events (organization_id, status);

-- 7. instagram_action_logs
CREATE TABLE public.instagram_action_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES public.instagram_automations(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.instagram_sessions(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.instagram_events(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  action_index integer,
  status text NOT NULL DEFAULT 'pending',
  request_json jsonb,
  response_json jsonb,
  error_message text,
  latency_ms integer,
  human_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instagram_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org instagram action logs" ON public.instagram_action_logs FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram action logs" ON public.instagram_action_logs FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE INDEX idx_instagram_action_logs_org ON public.instagram_action_logs (organization_id, created_at DESC);

-- 8. instagram_jobs
CREATE TABLE public.instagram_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  reference_id uuid,
  payload_json jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instagram_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org instagram jobs" ON public.instagram_jobs FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram jobs" ON public.instagram_jobs FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram jobs" ON public.instagram_jobs FOR UPDATE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE INDEX idx_instagram_jobs_pending ON public.instagram_jobs (status, run_at) WHERE status = 'pending';

CREATE TRIGGER update_instagram_jobs_updated_at BEFORE UPDATE ON public.instagram_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_action_logs;
