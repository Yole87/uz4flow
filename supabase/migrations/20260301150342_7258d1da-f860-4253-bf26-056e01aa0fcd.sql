
-- Table: instagram_app_config (per-organization Instagram Meta App credentials)
CREATE TABLE public.instagram_app_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  app_id TEXT,
  app_secret_encrypted TEXT,
  app_secret_masked TEXT,
  webhook_verify_token TEXT,
  is_configured BOOLEAN NOT NULL DEFAULT false,
  redirect_uri TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT instagram_app_config_organization_id_key UNIQUE (organization_id)
);

-- RLS
ALTER TABLE public.instagram_app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org instagram app config"
  ON public.instagram_app_config FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can insert their org instagram app config"
  ON public.instagram_app_config FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can update their org instagram app config"
  ON public.instagram_app_config FOR UPDATE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can delete their org instagram app config"
  ON public.instagram_app_config FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
