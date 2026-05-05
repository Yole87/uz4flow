-- Adicionar colunas faltantes
ALTER TABLE public.affiliate_settings
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'recurring',
  ADD COLUMN IF NOT EXISTS payout_day_of_month smallint NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS approval_sla_hours smallint NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS allow_self_referral boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_paid_traffic_on_brand boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kit_url text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Constraints (só adiciona se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_settings_commission_type_check') THEN
    ALTER TABLE public.affiliate_settings
      ADD CONSTRAINT affiliate_settings_commission_type_check
      CHECK (commission_type IN ('recurring','one_time'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_settings_payout_day_check') THEN
    ALTER TABLE public.affiliate_settings
      ADD CONSTRAINT affiliate_settings_payout_day_check
      CHECK (payout_day_of_month BETWEEN 1 AND 28);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_settings_approval_sla_check') THEN
    ALTER TABLE public.affiliate_settings
      ADD CONSTRAINT affiliate_settings_approval_sla_check
      CHECK (approval_sla_hours BETWEEN 1 AND 168);
  END IF;
END $$;

-- Liberar leitura pública (anon + authenticated) para a página /affiliates/onboarding sem login
DROP POLICY IF EXISTS "Anyone authenticated can read settings" ON public.affiliate_settings;
DROP POLICY IF EXISTS "Public can read affiliate settings" ON public.affiliate_settings;
CREATE POLICY "Public can read affiliate settings"
  ON public.affiliate_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);