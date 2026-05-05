-- 1. instances: channel + instagram_account_id
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS instagram_account_id UUID REFERENCES public.instagram_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.instances
  DROP CONSTRAINT IF EXISTS instances_channel_check;
ALTER TABLE public.instances
  ADD CONSTRAINT instances_channel_check CHECK (channel IN ('whatsapp', 'instagram'));

CREATE INDEX IF NOT EXISTS idx_instances_channel ON public.instances(channel);
CREATE INDEX IF NOT EXISTS idx_instances_instagram_account ON public.instances(instagram_account_id) WHERE instagram_account_id IS NOT NULL;

-- 2. contacts: channel + ig_user_scoped_id
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS ig_user_scoped_id TEXT;

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_channel_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_channel_check CHECK (channel IN ('whatsapp', 'instagram'));

-- Permitir phone vazio para contatos do Instagram
ALTER TABLE public.contacts ALTER COLUMN phone DROP NOT NULL;

-- Unique by channel: evita colisão entre whatsapp/instagram
CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_channel_phone_uniq
  ON public.contacts(organization_id, channel, phone)
  WHERE channel = 'whatsapp' AND phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_channel_igsid_uniq
  ON public.contacts(organization_id, channel, ig_user_scoped_id)
  WHERE channel = 'instagram' AND ig_user_scoped_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_channel ON public.contacts(channel);
CREATE INDEX IF NOT EXISTS idx_contacts_ig_scoped_id ON public.contacts(ig_user_scoped_id) WHERE ig_user_scoped_id IS NOT NULL;

-- 3. conversations: channel + dm_window_expires_at
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS dm_window_expires_at TIMESTAMPTZ;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_channel_check;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_channel_check CHECK (channel IN ('whatsapp', 'instagram'));

CREATE INDEX IF NOT EXISTS idx_conversations_channel ON public.conversations(channel);