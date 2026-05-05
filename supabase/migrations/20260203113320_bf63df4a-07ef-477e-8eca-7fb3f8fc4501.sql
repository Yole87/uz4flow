-- Add Browserless API key columns to prospect_providers table
ALTER TABLE public.prospect_providers
ADD COLUMN IF NOT EXISTS browserless_api_key_encrypted text,
ADD COLUMN IF NOT EXISTS browserless_api_key_masked text,
ADD COLUMN IF NOT EXISTS browserless_configured boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS browserless_last_test_at timestamp with time zone;