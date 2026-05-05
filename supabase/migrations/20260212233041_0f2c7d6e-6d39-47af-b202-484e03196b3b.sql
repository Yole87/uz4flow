
-- Add individual price columns per billing cycle to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN price_quarterly numeric DEFAULT NULL,
ADD COLUMN price_semiannual numeric DEFAULT NULL,
ADD COLUMN price_yearly numeric DEFAULT NULL;

-- Add billing_cycle column to subscriptions to track which cycle the user chose
ALTER TABLE public.subscriptions 
ADD COLUMN billing_cycle text DEFAULT 'monthly';

-- Rename existing 'price' to be the monthly price (it already is, just documenting)
-- The existing 'billing_cycle' on subscription_plans is now deprecated in favor of per-cycle prices
-- but we keep it for backward compat

-- Set yearly prices for existing plans based on 20% discount
UPDATE public.subscription_plans 
SET price_yearly = price * 12 * 0.8
WHERE is_free = false AND price > 0;

COMMENT ON COLUMN public.subscription_plans.price IS 'Monthly price (base)';
COMMENT ON COLUMN public.subscription_plans.price_quarterly IS 'Total price for 3-month cycle';
COMMENT ON COLUMN public.subscription_plans.price_semiannual IS 'Total price for 6-month cycle';
COMMENT ON COLUMN public.subscription_plans.price_yearly IS 'Total price for 12-month cycle';
COMMENT ON COLUMN public.subscriptions.billing_cycle IS 'Billing cycle chosen by user: monthly, quarterly, semiannual, yearly';
