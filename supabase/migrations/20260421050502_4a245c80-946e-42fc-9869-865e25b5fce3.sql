ALTER TABLE public.affiliate_settings 
ADD COLUMN IF NOT EXISTS program_enabled boolean NOT NULL DEFAULT true;