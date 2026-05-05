-- Add openbot_api_key_encrypted column to instances table
-- This stores the API Key specific to each OpenBot instance

ALTER TABLE public.instances 
ADD COLUMN IF NOT EXISTS openbot_api_key_encrypted TEXT;

COMMENT ON COLUMN public.instances.openbot_api_key_encrypted 
IS 'API Key do OpenBot específica desta instância (criptografada)';