-- 1. Add columns to voice_calls
ALTER TABLE public.voice_calls
  ADD COLUMN IF NOT EXISTS flow_session_id uuid REFERENCES public.flow_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS flow_step_id uuid REFERENCES public.flow_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS flow_attempt_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS flow_outcome text,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_voice_calls_flow_session ON public.voice_calls(flow_session_id, status) WHERE flow_session_id IS NOT NULL;

-- 2. Add voice_config to flow_steps
ALTER TABLE public.flow_steps
  ADD COLUMN IF NOT EXISTS voice_config jsonb;

-- 3. Create flow_voice_pending queue table
CREATE TABLE IF NOT EXISTS public.flow_voice_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_session_id uuid NOT NULL REFERENCES public.flow_sessions(id) ON DELETE CASCADE,
  flow_step_id uuid NOT NULL REFERENCES public.flow_steps(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  dispatched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_voice_pending_cron ON public.flow_voice_pending(status, scheduled_for) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_flow_voice_pending_session ON public.flow_voice_pending(flow_session_id);
CREATE INDEX IF NOT EXISTS idx_flow_voice_pending_org ON public.flow_voice_pending(organization_id);

ALTER TABLE public.flow_voice_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view flow voice pending"
  ON public.flow_voice_pending FOR SELECT
  USING (
    organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    OR public.is_admin_master()
  );

CREATE POLICY "Owners and admin can manage flow voice pending"
  ON public.flow_voice_pending FOR ALL
  USING (
    public.is_organization_owner(organization_id, auth.uid())
    OR public.is_admin_master()
  )
  WITH CHECK (
    public.is_organization_owner(organization_id, auth.uid())
    OR public.is_admin_master()
  );

CREATE TRIGGER trg_flow_voice_pending_updated_at
  BEFORE UPDATE ON public.flow_voice_pending
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();