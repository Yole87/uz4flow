-- Create scheduled_messages table
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.instances(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  file_name TEXT,
  mime_type TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_scheduled_messages_conversation ON public.scheduled_messages(conversation_id);
CREATE INDEX idx_scheduled_messages_org_status ON public.scheduled_messages(organization_id, status);
CREATE INDEX idx_scheduled_messages_pending ON public.scheduled_messages(scheduled_for) WHERE status = 'pending';

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_scheduled_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending','sent','failed','cancelled') THEN
    RAISE EXCEPTION 'status must be pending, sent, failed or cancelled';
  END IF;
  IF (NEW.content IS NULL OR length(trim(NEW.content)) = 0) AND (NEW.media_url IS NULL OR length(trim(NEW.media_url)) = 0) THEN
    RAISE EXCEPTION 'scheduled message requires content or media_url';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_scheduled_message
BEFORE INSERT OR UPDATE ON public.scheduled_messages
FOR EACH ROW EXECUTE FUNCTION public.validate_scheduled_message();

CREATE TRIGGER trg_scheduled_messages_updated_at
BEFORE UPDATE ON public.scheduled_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Org members can view scheduled messages"
ON public.scheduled_messages FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can create scheduled messages"
ON public.scheduled_messages FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  AND created_by = auth.uid()
);

CREATE POLICY "Org members can update scheduled messages"
ON public.scheduled_messages FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can delete scheduled messages"
ON public.scheduled_messages FOR DELETE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

-- Realtime
ALTER TABLE public.scheduled_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_messages;