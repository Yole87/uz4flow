
ALTER TABLE public.voice_calls ADD COLUMN IF NOT EXISTS whatsapp_followup_enabled boolean DEFAULT false;
ALTER TABLE public.voice_calls ADD COLUMN IF NOT EXISTS whatsapp_followup_text text;
ALTER TABLE public.voice_calls ADD COLUMN IF NOT EXISTS whatsapp_followup_file_url text;
ALTER TABLE public.voice_calls ADD COLUMN IF NOT EXISTS whatsapp_followup_sent boolean DEFAULT false;
