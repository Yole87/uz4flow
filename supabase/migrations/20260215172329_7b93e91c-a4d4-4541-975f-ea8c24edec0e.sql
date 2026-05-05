
-- Add new columns to voice_campaigns for follow-up functionality
ALTER TABLE public.voice_campaigns 
  ADD COLUMN IF NOT EXISTS call_reason text,
  ADD COLUMN IF NOT EXISTS whatsapp_followup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_followup_text text,
  ADD COLUMN IF NOT EXISTS whatsapp_followup_file_url text,
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS webhook_enabled boolean NOT NULL DEFAULT false;

-- Add columns to voice_campaign_contacts for manual contacts
ALTER TABLE public.voice_campaign_contacts 
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS name text;

-- Add webhook_url to voice_calls
ALTER TABLE public.voice_calls 
  ADD COLUMN IF NOT EXISTS webhook_url text;
