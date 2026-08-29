-- Table to store per-tenant Google Calendar OAuth credentials
CREATE TABLE IF NOT EXISTS public.google_calendar_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only service_role can read/write (no direct client access to secrets)
ALTER TABLE public.google_calendar_credentials ENABLE ROW LEVEL SECURITY;

-- No RLS policies = service_role only access (anon/authenticated cannot read)
GRANT ALL ON public.google_calendar_credentials TO service_role;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_google_calendar_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_google_calendar_credentials_updated_at
  BEFORE UPDATE ON public.google_calendar_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_google_calendar_credentials_updated_at();
