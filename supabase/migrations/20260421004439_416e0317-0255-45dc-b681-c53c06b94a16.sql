
-- ============================================
-- AFFILIATE SYSTEM — Initial schema
-- ============================================

-- Enums
CREATE TYPE public.affiliate_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE public.commission_status AS ENUM ('pending_grace', 'available', 'paid', 'cancelled');
CREATE TYPE public.payout_status AS ENUM ('requested', 'processing', 'paid', 'rejected');
CREATE TYPE public.referral_status AS ENUM ('signup', 'trial', 'active', 'cancelled', 'expired_window');

-- ============================================
-- affiliate_settings (singleton)
-- ============================================
CREATE TABLE public.affiliate_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_commission_percent numeric(5,2) NOT NULL DEFAULT 20.00,
  min_payout numeric(10,2) NOT NULL DEFAULT 50.00,
  payout_processing_hours int NOT NULL DEFAULT 72,
  tax_percent numeric(5,2) NOT NULL DEFAULT 6.00,
  grace_period_days int NOT NULL DEFAULT 8,
  attribution_window_days int NOT NULL DEFAULT 30,
  current_terms_version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default
INSERT INTO public.affiliate_settings (id) VALUES (gen_random_uuid());

ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read settings"
  ON public.affiliate_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin master can update settings"
  ON public.affiliate_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin_master());

-- ============================================
-- affiliate_terms_versions
-- ============================================
CREATE TABLE public.affiliate_terms_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL UNIQUE,
  body_md text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.affiliate_terms_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read terms"
  ON public.affiliate_terms_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin master manages terms"
  ON public.affiliate_terms_versions FOR ALL
  TO authenticated
  USING (public.is_admin_master())
  WITH CHECK (public.is_admin_master());

-- Default terms
INSERT INTO public.affiliate_terms_versions (version, body_md) VALUES (
  1,
  E'# Termos do Programa de Afiliados OpenFlow\n\n## 1. Comissões\nO afiliado receberá uma comissão sobre cada nova assinatura paga gerada por seu link de indicação, conforme percentual definido no momento da aprovação.\n\n## 2. Janela de Atribuição\nA conversão é válida quando o cadastro do indicado ocorre em até **30 dias corridos** após o clique no link de afiliado. Cadastros fora dessa janela não geram comissão.\n\n## 3. Período de Carência\nA comissão fica indisponível para saque pelos primeiros **8 dias corridos** após o pagamento confirmado, em respeito ao direito de arrependimento de 7 dias do consumidor (CDC art. 49). Em caso de reembolso nesse período, a comissão é cancelada automaticamente.\n\n## 4. Imposto Retido na Fonte\nSerá descontada uma taxa fixa e única de **6% sobre o valor bruto do saque** para recolhimento de impostos. Este valor é informado em todos os extratos antes da solicitação.\n\n## 5. Prazo de Pagamento\nApós a solicitação de saque (respeitado o valor mínimo definido pela plataforma), o pagamento é realizado em até **72 horas úteis** via PIX, na chave informada pelo afiliado.\n\n## 6. Conduta\nÉ vedada qualquer prática de spam, propaganda enganosa, autoindicação (cadastrar a si mesmo) ou indução de cancelamento posterior à comissão. O descumprimento implica suspensão imediata e perda de comissões pendentes.\n\n## 7. Suspensão e Cancelamento\nA OpenFlow pode suspender ou encerrar a conta de afiliado a qualquer momento em caso de violação destes termos, com aviso prévio quando aplicável.\n\n## 8. Privacidade dos Indicados\nO afiliado tem acesso apenas aos dados básicos (nome, e-mail, status) dos indicados convertidos dentro da janela de 30 dias. Indicados fora do prazo permanecem sob gestão exclusiva da plataforma.\n\n## 9. Aceite\nAo marcar a opção "Li e concordo", o afiliado declara ter lido, compreendido e aceito integralmente todos os termos acima.'
);

-- ============================================
-- affiliates
-- ============================================
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  status public.affiliate_status NOT NULL DEFAULT 'pending',
  commission_percent numeric(5,2),
  min_payout numeric(10,2),
  
  -- Bank data
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_type text, -- 'corrente' | 'poupanca'
  bank_holder_name text,
  bank_holder_document text, -- CPF/CNPJ
  
  -- PIX
  pix_key_type text, -- 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'
  pix_key text,
  
  -- Terms
  terms_version int,
  terms_accepted_at timestamptz,
  
  -- Admin notes
  admin_notes text,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX idx_affiliates_code ON public.affiliates(code);
CREATE INDEX idx_affiliates_status ON public.affiliates(status);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view own record"
  ON public.affiliates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_master());

CREATE POLICY "Users can create their own affiliate request"
  ON public.affiliates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Affiliates can update own pending data"
  ON public.affiliates FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_master())
  WITH CHECK (user_id = auth.uid() OR public.is_admin_master());

CREATE POLICY "Admin master can delete"
  ON public.affiliates FOR DELETE
  TO authenticated
  USING (public.is_admin_master());

-- ============================================
-- Function: generate_affiliate_code
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_exists boolean;
  v_attempts int := 0;
BEGIN
  LOOP
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    SELECT EXISTS (SELECT 1 FROM public.affiliates WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists OR v_attempts > 10;
    v_attempts := v_attempts + 1;
  END LOOP;
  RETURN v_code;
END;
$$;

-- ============================================
-- Function: is_affiliate
-- ============================================
CREATE OR REPLACE FUNCTION public.is_affiliate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.affiliates
    WHERE user_id = _user_id AND status = 'approved'
  )
$$;

-- ============================================
-- affiliate_clicks
-- ============================================
CREATE TABLE public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  ip_hash text,
  user_agent text,
  referer text,
  landing_page text,
  country text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_affiliate_clicks_code ON public.affiliate_clicks(code);
CREATE INDEX idx_affiliate_clicks_affiliate_id ON public.affiliate_clicks(affiliate_id);
CREATE INDEX idx_affiliate_clicks_created_at ON public.affiliate_clicks(created_at);

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own clicks"
  ON public.affiliate_clicks FOR SELECT
  TO authenticated
  USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
    OR public.is_admin_master()
  );

-- Edge function will insert via service role; no public insert policy needed.

-- ============================================
-- affiliate_referrals
-- ============================================
CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ref_code text NOT NULL,
  click_id uuid REFERENCES public.affiliate_clicks(id) ON DELETE SET NULL,
  signup_at timestamptz NOT NULL DEFAULT now(),
  attribution_expires_at timestamptz NOT NULL,
  first_payment_at timestamptz,
  current_status public.referral_status NOT NULL DEFAULT 'signup',
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

CREATE INDEX idx_affiliate_referrals_affiliate_id ON public.affiliate_referrals(affiliate_id);
CREATE INDEX idx_affiliate_referrals_referred_user ON public.affiliate_referrals(referred_user_id);
CREATE INDEX idx_affiliate_referrals_status ON public.affiliate_referrals(current_status);

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own referrals"
  ON public.affiliate_referrals FOR SELECT
  TO authenticated
  USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
    OR public.is_admin_master()
  );

CREATE POLICY "Admin master manages referrals"
  ON public.affiliate_referrals FOR ALL
  TO authenticated
  USING (public.is_admin_master())
  WITH CHECK (public.is_admin_master());

-- ============================================
-- affiliate_commissions
-- ============================================
CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id uuid NOT NULL REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  payment_id text, -- MercadoPago payment id
  gross_amount numeric(10,2) NOT NULL,
  commission_percent numeric(5,2) NOT NULL,
  commission_amount numeric(10,2) NOT NULL,
  status public.commission_status NOT NULL DEFAULT 'pending_grace',
  payment_date timestamptz NOT NULL DEFAULT now(),
  unlocks_at timestamptz NOT NULL,
  paid_at timestamptz,
  payout_id uuid,
  cancelled_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_affiliate_commissions_affiliate_id ON public.affiliate_commissions(affiliate_id);
CREATE INDEX idx_affiliate_commissions_status ON public.affiliate_commissions(status);
CREATE INDEX idx_affiliate_commissions_unlocks_at ON public.affiliate_commissions(unlocks_at);

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own commissions"
  ON public.affiliate_commissions FOR SELECT
  TO authenticated
  USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
    OR public.is_admin_master()
  );

CREATE POLICY "Admin master manages commissions"
  ON public.affiliate_commissions FOR ALL
  TO authenticated
  USING (public.is_admin_master())
  WITH CHECK (public.is_admin_master());

-- ============================================
-- affiliate_payouts
-- ============================================
CREATE TABLE public.affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  requested_amount numeric(10,2) NOT NULL,
  tax_percent numeric(5,2) NOT NULL DEFAULT 6.00,
  tax_amount numeric(10,2) NOT NULL,
  net_amount numeric(10,2) NOT NULL,
  status public.payout_status NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  paid_at timestamptz,
  proof_url text,
  admin_notes text,
  rejection_reason text,
  -- Snapshot of pix info at request time
  pix_key_type text,
  pix_key text,
  bank_holder_name text,
  bank_holder_document text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_affiliate_payouts_affiliate_id ON public.affiliate_payouts(affiliate_id);
CREATE INDEX idx_affiliate_payouts_status ON public.affiliate_payouts(status);

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own payouts"
  ON public.affiliate_payouts FOR SELECT
  TO authenticated
  USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
    OR public.is_admin_master()
  );

CREATE POLICY "Affiliates request own payouts"
  ON public.affiliate_payouts FOR INSERT
  TO authenticated
  WITH CHECK (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "Admin master manages payouts"
  ON public.affiliate_payouts FOR UPDATE
  TO authenticated
  USING (public.is_admin_master())
  WITH CHECK (public.is_admin_master());

CREATE POLICY "Admin master deletes payouts"
  ON public.affiliate_payouts FOR DELETE
  TO authenticated
  USING (public.is_admin_master());

-- ============================================
-- Triggers: updated_at
-- ============================================
CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_referrals_updated_at BEFORE UPDATE ON public.affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_commissions_updated_at BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_payouts_updated_at BEFORE UPDATE ON public.affiliate_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_settings_updated_at BEFORE UPDATE ON public.affiliate_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Function: handle_affiliate_referral_attribution
-- Trigger on profiles after handle_new_user; reads ref_code from auth metadata
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_affiliate_referral_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_code text;
  v_affiliate_id uuid;
  v_window_days int;
BEGIN
  -- Read ref_code from auth metadata
  SELECT raw_user_meta_data->>'ref_code' INTO v_ref_code
  FROM auth.users WHERE id = NEW.id;
  
  IF v_ref_code IS NULL OR length(v_ref_code) = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Find affiliate by code (must be approved)
  SELECT id INTO v_affiliate_id
  FROM public.affiliates
  WHERE code = v_ref_code AND status = 'approved'
  LIMIT 1;
  
  IF v_affiliate_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Anti self-referral
  IF v_affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  SELECT attribution_window_days INTO v_window_days FROM public.affiliate_settings LIMIT 1;
  v_window_days := COALESCE(v_window_days, 30);
  
  INSERT INTO public.affiliate_referrals (
    affiliate_id, referred_user_id, ref_code, signup_at, attribution_expires_at, current_status
  ) VALUES (
    v_affiliate_id, NEW.id, v_ref_code, now(), now() + (v_window_days || ' days')::interval, 'signup'
  )
  ON CONFLICT (referred_user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger on auth.users via handle_new_user pattern. Since we can't easily attach to auth.users,
-- we hook into profiles inserts (which already happen via handle_new_user).
DROP TRIGGER IF EXISTS on_profile_created_attribute_referral ON public.profiles;
CREATE TRIGGER on_profile_created_attribute_referral
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_affiliate_referral_attribution();

-- ============================================
-- Function: release_grace_commissions (cron)
-- ============================================
CREATE OR REPLACE FUNCTION public.release_grace_commissions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH released AS (
    UPDATE public.affiliate_commissions
    SET status = 'available', updated_at = now()
    WHERE status = 'pending_grace' AND unlocks_at <= now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM released;
  
  RETURN jsonb_build_object('released', v_count, 'executed_at', now());
END;
$$;
