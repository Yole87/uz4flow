
-- Meta conversation windows table for tracking 24h/72h message windows
CREATE TABLE public.meta_conversation_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  window_type text NOT NULL DEFAULT '24h',
  window_expires_at timestamptz NOT NULL,
  last_customer_message_at timestamptz NOT NULL,
  is_from_campaign boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id)
);

ALTER TABLE public.meta_conversation_windows ENABLE ROW LEVEL SECURITY;

-- RLS: Allow org members to view windows for their conversations
CREATE POLICY "Org members can view meta windows"
  ON public.meta_conversation_windows
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.contacts ct ON ct.id = c.contact_id
      JOIN public.organization_members om ON om.organization_id = ct.organization_id
      WHERE c.id = meta_conversation_windows.conversation_id AND om.user_id = auth.uid()
    )
  );

-- Enable realtime for meta_conversation_windows
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_conversation_windows;
