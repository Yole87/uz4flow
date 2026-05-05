-- Add anti-blocking configuration columns to prospect_providers
ALTER TABLE public.prospect_providers
ADD COLUMN IF NOT EXISTS use_stealth_mode boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS use_residential_proxy boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_block_detected_at timestamptz,
ADD COLUMN IF NOT EXISTS block_count integer DEFAULT 0;