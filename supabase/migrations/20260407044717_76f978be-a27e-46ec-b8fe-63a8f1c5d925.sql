
ALTER TABLE public.conversation_evaluation_configs
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_phones text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS whatsapp_distribution text NOT NULL DEFAULT 'linear',
  ADD COLUMN IF NOT EXISTS whatsapp_counter integer NOT NULL DEFAULT 0;
