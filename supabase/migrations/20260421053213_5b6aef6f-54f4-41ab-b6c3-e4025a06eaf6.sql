ALTER TABLE public.admin_notification_config 
ADD COLUMN IF NOT EXISTS openbot_token_encrypted TEXT;