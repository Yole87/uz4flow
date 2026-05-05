
-- Add refunded_amount to subscription_payments
ALTER TABLE public.subscription_payments 
  ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT 0;

-- Add chargeback_count and total_refunded to subscriptions
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS chargeback_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_refunded numeric NOT NULL DEFAULT 0;
