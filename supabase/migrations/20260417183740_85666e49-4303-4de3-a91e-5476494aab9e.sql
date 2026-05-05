ALTER TABLE public.voice_campaign_contacts
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS attempted_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_voice_campaign_contacts_status_campaign
ON public.voice_campaign_contacts (campaign_id, status);