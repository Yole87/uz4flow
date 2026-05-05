
CREATE TABLE public.payment_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_action text,
  mp_id text,
  status text,
  status_detail text,
  status_detail_description text,
  amount numeric,
  payer_email text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  organization_name text,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  error_message text,
  raw_payload jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_webhook_logs_created_at ON public.payment_webhook_logs (created_at DESC);
CREATE INDEX idx_payment_webhook_logs_org ON public.payment_webhook_logs (organization_id);

ALTER TABLE public.payment_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin master can view payment logs"
  ON public.payment_webhook_logs FOR SELECT
  TO authenticated
  USING (public.is_admin_master());

CREATE POLICY "Service role can insert payment logs"
  ON public.payment_webhook_logs FOR INSERT
  TO service_role
  WITH CHECK (true);
