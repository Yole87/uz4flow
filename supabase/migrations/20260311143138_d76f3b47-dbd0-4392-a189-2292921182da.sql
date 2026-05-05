
CREATE TABLE public.flow_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_enabled boolean DEFAULT true,
  webhook_url text NOT NULL,
  http_method text DEFAULT 'POST',
  headers jsonb DEFAULT '{}',
  payload_template text NOT NULL DEFAULT '{}',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(flow_id)
);

ALTER TABLE public.flow_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own flow webhooks"
  ON public.flow_webhooks FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin_master'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin_master'));
