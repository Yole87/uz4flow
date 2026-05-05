
-- =========================================================
-- AFFILIATE COMMISSION PROCESSING (helper RPC)
-- Used by mercadopago-webhook on payment.approved/refund
-- =========================================================
CREATE OR REPLACE FUNCTION public.process_affiliate_payment(
  p_user_id uuid,
  p_subscription_id uuid,
  p_payment_id text,
  p_gross_amount numeric,
  p_payment_status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_aff RECORD;
  v_settings RECORD;
  v_grace_days int;
  v_commission_pct numeric;
  v_commission_amt numeric;
  v_existing uuid;
  v_unlocks_at timestamptz;
BEGIN
  -- Find pending referral for this user (only first conversion counts)
  SELECT * INTO v_referral
  FROM public.affiliate_referrals
  WHERE referred_user_id = p_user_id
    AND first_payment_at IS NULL
    AND attribution_expires_at >= now()
  LIMIT 1;

  IF v_referral.id IS NULL THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'no_active_referral');
  END IF;

  -- Get affiliate
  SELECT * INTO v_aff FROM public.affiliates WHERE id = v_referral.affiliate_id;
  IF v_aff.id IS NULL OR v_aff.status <> 'approved' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'affiliate_not_approved');
  END IF;

  -- Settings
  SELECT * INTO v_settings FROM public.affiliate_settings LIMIT 1;
  v_grace_days := COALESCE(v_settings.grace_period_days, 8);
  v_commission_pct := COALESCE(v_aff.commission_percent, v_settings.default_commission_percent, 20);
  v_commission_amt := round((p_gross_amount * v_commission_pct / 100)::numeric, 2);
  v_unlocks_at := now() + (v_grace_days || ' days')::interval;

  -- Idempotency: check if commission already exists for this payment
  SELECT id INTO v_existing
  FROM public.affiliate_commissions
  WHERE payment_id = p_payment_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'duplicate_payment', 'commission_id', v_existing);
  END IF;

  -- Handle refund: cancel any existing commission for this payment
  IF p_payment_status = 'refunded' THEN
    UPDATE public.affiliate_commissions
    SET status = 'cancelled', cancelled_reason = 'refund', updated_at = now()
    WHERE referral_id = v_referral.id AND status IN ('pending_grace', 'available');
    RETURN jsonb_build_object('refunded', true, 'referral_id', v_referral.id);
  END IF;

  -- Create commission
  INSERT INTO public.affiliate_commissions (
    affiliate_id, referral_id, subscription_id, payment_id,
    gross_amount, commission_percent, commission_amount,
    status, unlocks_at, payment_date
  ) VALUES (
    v_aff.id, v_referral.id, p_subscription_id, p_payment_id,
    p_gross_amount, v_commission_pct, v_commission_amt,
    'pending_grace', v_unlocks_at, now()
  );

  -- Update referral status + first payment
  UPDATE public.affiliate_referrals
  SET first_payment_at = now(), current_status = 'active', updated_at = now()
  WHERE id = v_referral.id;

  RETURN jsonb_build_object(
    'created', true,
    'commission_amount', v_commission_amt,
    'unlocks_at', v_unlocks_at,
    'affiliate_id', v_aff.id
  );
END;
$$;

-- =========================================================
-- ADMIN NOTIFICATIONS CENTER (WhatsApp via OpenBot)
-- =========================================================

-- Event types catalog
CREATE TYPE public.admin_notif_event AS ENUM (
  'signup_free',
  'free_plan_expiring',
  'upgrade_free_to_paid',
  'plan_change',
  'payment_received',
  'cancel_refund',
  'cancel_unpaid',
  'affiliate_signup_request',
  'affiliate_new_referral',
  'affiliate_payout_request'
);

-- Templates (one per event, but historically versioned)
CREATE TABLE public.admin_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.admin_notif_event NOT NULL,
  name text NOT NULL,
  body text NOT NULL,
  variables text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_notif_templates_event ON public.admin_notification_templates(event_type) WHERE is_active = true;

-- Rules: enable/disable per event
CREATE TABLE public.admin_notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.admin_notif_event NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  template_id uuid REFERENCES public.admin_notification_templates(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Recipients (max 3, validated via trigger)
CREATE TABLE public.admin_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.enforce_max_3_recipients()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.admin_notification_recipients) >= 3 THEN
    RAISE EXCEPTION 'Máximo de 3 destinatários permitido';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_max_3_recipients
  BEFORE INSERT ON public.admin_notification_recipients
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_3_recipients();

-- OpenBot config (single row)
CREATE TABLE public.admin_notification_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openbot_base_url text,
  openbot_instance_id text,
  openbot_api_key_encrypted text,
  is_configured boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Logs
CREATE TABLE public.admin_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.admin_notif_event NOT NULL,
  recipient_phone text NOT NULL,
  recipient_name text,
  rendered_body text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_notif_logs_created ON public.admin_notification_logs(created_at DESC);
CREATE INDEX idx_admin_notif_logs_event ON public.admin_notification_logs(event_type, created_at DESC);

-- RLS — admin only
ALTER TABLE public.admin_notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_master full access templates" ON public.admin_notification_templates
  FOR ALL TO authenticated USING (public.is_admin_master()) WITH CHECK (public.is_admin_master());
CREATE POLICY "admin_master full access rules" ON public.admin_notification_rules
  FOR ALL TO authenticated USING (public.is_admin_master()) WITH CHECK (public.is_admin_master());
CREATE POLICY "admin_master full access recipients" ON public.admin_notification_recipients
  FOR ALL TO authenticated USING (public.is_admin_master()) WITH CHECK (public.is_admin_master());
CREATE POLICY "admin_master full access config" ON public.admin_notification_config
  FOR ALL TO authenticated USING (public.is_admin_master()) WITH CHECK (public.is_admin_master());
CREATE POLICY "admin_master read logs" ON public.admin_notification_logs
  FOR SELECT TO authenticated USING (public.is_admin_master());

-- updated_at triggers
CREATE TRIGGER trg_admin_notif_templates_updated BEFORE UPDATE ON public.admin_notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_admin_notif_rules_updated BEFORE UPDATE ON public.admin_notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_admin_notif_config_updated BEFORE UPDATE ON public.admin_notification_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default templates (PT-BR)
INSERT INTO public.admin_notification_templates (event_type, name, body, variables) VALUES
  ('signup_free', 'Novo cadastro grátis', E'🆕 Novo usuário no plano grátis!\n\nNome: {user_name}\nEmail: {user_email}\nData: {date}', ARRAY['user_name','user_email','date']),
  ('free_plan_expiring', 'Plano grátis vencendo', E'⏳ Plano grátis vencendo em breve\n\nCliente: {user_name} ({user_email})\nVence em: {date}', ARRAY['user_name','user_email','date']),
  ('upgrade_free_to_paid', 'Upgrade grátis → pago', E'🚀 Upgrade!\n\n{user_name} migrou para o plano {plan_name}\nValor: R$ {amount}', ARRAY['user_name','plan_name','amount']),
  ('plan_change', 'Mudança de plano', E'🔄 Mudança de plano\n\n{user_name} mudou para {plan_name}\nValor: R$ {amount}', ARRAY['user_name','plan_name','amount']),
  ('payment_received', 'Pagamento recebido', E'💰 Pagamento aprovado\n\nCliente: {user_name}\nPlano: {plan_name}\nValor: R$ {amount}\nData: {date}', ARRAY['user_name','plan_name','amount','date']),
  ('cancel_refund', 'Cancelamento por reembolso', E'❌ Reembolso processado\n\nCliente: {user_name}\nValor: R$ {amount}\nMotivo: {reason}', ARRAY['user_name','amount','reason']),
  ('cancel_unpaid', 'Cancelamento por inadimplência', E'⚠️ Cliente inadimplente cancelado\n\nCliente: {user_name}\nDias atraso: {days}', ARRAY['user_name','days']),
  ('affiliate_signup_request', 'Novo pedido de afiliação', E'🤝 Novo pedido de afiliação!\n\nNome: {affiliate_name}\nEmail: {user_email}\nCódigo: {affiliate_code}\n\nAcesse o painel admin para aprovar.', ARRAY['affiliate_name','user_email','affiliate_code']),
  ('affiliate_new_referral', 'Novo indicado', E'🎯 Novo indicado!\n\nAfiliado: {affiliate_name} ({affiliate_code})\nIndicado: {user_name}\nStatus: {status}', ARRAY['affiliate_name','affiliate_code','user_name','status']),
  ('affiliate_payout_request', 'Pedido de saque', E'💸 Pedido de saque\n\nAfiliado: {affiliate_name}\nValor bruto: R$ {amount}\nValor líquido (após 6%): R$ {net_amount}\nPIX: {pix_key}', ARRAY['affiliate_name','amount','net_amount','pix_key']);

-- Initialize rules (all disabled by default, linked to seeded templates)
INSERT INTO public.admin_notification_rules (event_type, enabled, template_id)
SELECT t.event_type, false, t.id FROM public.admin_notification_templates t;

-- Initialize empty config row
INSERT INTO public.admin_notification_config (is_configured) VALUES (false);
