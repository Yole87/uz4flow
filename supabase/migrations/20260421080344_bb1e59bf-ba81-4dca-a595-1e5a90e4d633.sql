-- 1. Tabela de histórico de affiliate_settings
CREATE TABLE IF NOT EXISTS public.affiliate_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changes jsonb NOT NULL,
  snapshot jsonb NOT NULL
);

ALTER TABLE public.affiliate_settings_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "history_admin_read" ON public.affiliate_settings_history;
CREATE POLICY "history_admin_read"
  ON public.affiliate_settings_history
  FOR SELECT
  USING (public.is_admin_master());

CREATE INDEX IF NOT EXISTS idx_affiliate_settings_history_changed_at
  ON public.affiliate_settings_history (changed_at DESC);

-- 2. Função de auditoria
CREATE OR REPLACE FUNCTION public.audit_affiliate_settings_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
  v_field text;
  v_old jsonb;
  v_new jsonb;
  v_tracked text[] := ARRAY[
    'default_commission_percent','min_payout','tax_percent','grace_period_days',
    'attribution_window_days','payout_processing_hours','current_terms_version',
    'program_enabled','commission_type','payout_day_of_month','approval_sla_hours',
    'allow_self_referral','allow_paid_traffic_on_brand','kit_url'
  ];
BEGIN
  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH v_field IN ARRAY v_tracked LOOP
    IF (v_old->v_field) IS DISTINCT FROM (v_new->v_field) THEN
      v_changes := v_changes || jsonb_build_object(
        v_field,
        jsonb_build_object('from', v_old->v_field, 'to', v_new->v_field)
      );
    END IF;
  END LOOP;

  IF v_changes <> '{}'::jsonb THEN
    INSERT INTO public.affiliate_settings_history (changed_by, changes, snapshot)
    VALUES (NEW.updated_by, v_changes, v_new);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS affiliate_settings_audit ON public.affiliate_settings;
CREATE TRIGGER affiliate_settings_audit
  AFTER UPDATE ON public.affiliate_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_affiliate_settings_changes();

-- 3. RLS para affiliate_terms_versions (admin_master pode INSERT/SELECT)
ALTER TABLE public.affiliate_terms_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terms_versions_public_read" ON public.affiliate_terms_versions;
CREATE POLICY "terms_versions_public_read"
  ON public.affiliate_terms_versions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "terms_versions_admin_insert" ON public.affiliate_terms_versions;
CREATE POLICY "terms_versions_admin_insert"
  ON public.affiliate_terms_versions
  FOR INSERT
  WITH CHECK (public.is_admin_master());

-- 4. Recria handle_affiliate_referral_attribution lendo allow_self_referral
CREATE OR REPLACE FUNCTION public.handle_affiliate_referral_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_code text;
  v_affiliate_id uuid;
  v_aff_user_id uuid;
  v_window_days int;
  v_aff_user_email text;
  v_referred_email text;
  v_allow_self boolean;
BEGIN
  SELECT raw_user_meta_data->>'ref_code' INTO v_ref_code FROM auth.users WHERE id = NEW.id;

  IF v_ref_code IS NULL OR length(v_ref_code) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT id, user_id INTO v_affiliate_id, v_aff_user_id
  FROM public.affiliates
  WHERE code = v_ref_code AND status = 'approved'
  LIMIT 1;

  IF v_affiliate_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sempre bloqueia auto-indicação por user_id (mesma conta)
  IF v_aff_user_id = NEW.id THEN
    RETURN NEW;
  END IF;

  -- Lê flag de auto-indicação
  SELECT allow_self_referral, attribution_window_days
    INTO v_allow_self, v_window_days
  FROM public.affiliate_settings
  LIMIT 1;
  v_allow_self := COALESCE(v_allow_self, false);
  v_window_days := COALESCE(v_window_days, 30);

  -- Carrega emails para validação e notificação
  SELECT email INTO v_referred_email FROM auth.users WHERE id = NEW.id;
  SELECT email INTO v_aff_user_email FROM auth.users WHERE id = v_aff_user_id;

  -- Se auto-indicação não é permitida, bloqueia também por email
  IF NOT v_allow_self
     AND v_aff_user_email IS NOT NULL
     AND v_referred_email IS NOT NULL
     AND lower(v_aff_user_email) = lower(v_referred_email) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.affiliate_referrals (
    affiliate_id, referred_user_id, ref_code, signup_at, attribution_expires_at, current_status
  ) VALUES (
    v_affiliate_id, NEW.id, v_ref_code, now(), now() + (v_window_days || ' days')::interval, 'signup'
  )
  ON CONFLICT (referred_user_id) DO NOTHING;

  PERFORM public.notify_admin_async('affiliate_new_referral', jsonb_build_object(
    'affiliate_email', COALESCE(v_aff_user_email, ''),
    'affiliate_code', v_ref_code,
    'user_email', COALESCE(v_referred_email, ''),
    'date', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
  ));

  RETURN NEW;
END;
$$;