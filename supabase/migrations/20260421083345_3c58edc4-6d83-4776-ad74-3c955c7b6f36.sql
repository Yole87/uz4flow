-- Permitir 0 (sem dia fixo) no payout_day_of_month
ALTER TABLE public.affiliate_settings DROP CONSTRAINT IF EXISTS affiliate_settings_payout_day_check;
ALTER TABLE public.affiliate_settings
  ADD CONSTRAINT affiliate_settings_payout_day_check
  CHECK (payout_day_of_month BETWEEN 0 AND 28);