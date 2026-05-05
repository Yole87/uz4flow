-- Tabela de lembretes pessoais do atendente
CREATE TABLE public.agent_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validação de status via trigger (evita CHECK rígido)
CREATE OR REPLACE FUNCTION public.validate_agent_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'done', 'dismissed') THEN
    RAISE EXCEPTION 'status must be pending, done or dismissed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_agent_reminder_trigger
BEFORE INSERT OR UPDATE ON public.agent_reminders
FOR EACH ROW EXECUTE FUNCTION public.validate_agent_reminder();

CREATE TRIGGER agent_reminders_updated_at
BEFORE UPDATE ON public.agent_reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_agent_reminders_user_status ON public.agent_reminders(user_id, status, remind_at);
CREATE INDEX idx_agent_reminders_contact ON public.agent_reminders(contact_id);
CREATE INDEX idx_agent_reminders_org ON public.agent_reminders(organization_id);

-- RLS
ALTER TABLE public.agent_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own reminders"
ON public.agent_reminders FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_admin_master());

CREATE POLICY "Users insert own reminders"
ON public.agent_reminders FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own reminders"
ON public.agent_reminders FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own reminders"
ON public.agent_reminders FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Realtime
ALTER TABLE public.agent_reminders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_reminders;