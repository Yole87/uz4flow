-- =============================================================================
-- Formulários / Webhook Sources
-- Creates 3 tables for managing external form lead capture via webhooks.
-- Follows the project's multi-tenant pattern (organization_id scoped via
-- get_user_organization_ids) and reuses update_updated_at_column() trigger.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- 1. prospect_sources
--    One row per form origin (e.g. one Elementor form, one Typeform, etc.)
--    Holds the webhook token used to authenticate incoming POST requests.
-- ----------------------------------------------------------------------------
CREATE TABLE public.prospect_sources (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  webhook_token   TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_prospect_sources_organization_id
  ON public.prospect_sources(organization_id);

-- updated_at trigger — reuses the project-wide function, no new function created
CREATE TRIGGER trg_prospect_sources_updated_at
BEFORE UPDATE ON public.prospect_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.prospect_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their prospect sources"
ON public.prospect_sources FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can insert their prospect sources"
ON public.prospect_sources FOR INSERT
TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can update their prospect sources"
ON public.prospect_sources FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can delete their prospect sources"
ON public.prospect_sources FOR DELETE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));


-- ----------------------------------------------------------------------------
-- 2. prospect_columns
--    Configurable columns per source. key_name must match the Elementor field
--    ID exactly. col_order controls display order in the UI grid.
-- ----------------------------------------------------------------------------
CREATE TABLE public.prospect_columns (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id      UUID        NOT NULL REFERENCES public.prospect_sources(id) ON DELETE CASCADE,
  key_name       TEXT        NOT NULL,
  label          TEXT        NOT NULL,
  col_type       TEXT        NOT NULL DEFAULT 'text' CHECK (col_type IN ('text', 'select')),
  select_options JSONB       NOT NULL DEFAULT '[]'::jsonb,
  col_order      INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, key_name)
);

-- No updated_at on prospect_columns (no updated_at column, columns are
-- replaced/deleted rather than patched in practice).

-- RLS — scoped via source_id → prospect_sources.organization_id
ALTER TABLE public.prospect_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their prospect columns"
ON public.prospect_columns FOR SELECT
TO authenticated
USING (
  source_id IN (
    SELECT id FROM public.prospect_sources
    WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Org members can insert their prospect columns"
ON public.prospect_columns FOR INSERT
TO authenticated
WITH CHECK (
  source_id IN (
    SELECT id FROM public.prospect_sources
    WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Org members can update their prospect columns"
ON public.prospect_columns FOR UPDATE
TO authenticated
USING (
  source_id IN (
    SELECT id FROM public.prospect_sources
    WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Org members can delete their prospect columns"
ON public.prospect_columns FOR DELETE
TO authenticated
USING (
  source_id IN (
    SELECT id FROM public.prospect_sources
    WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);


-- ----------------------------------------------------------------------------
-- 3. prospect_leads
--    One row per incoming webhook payload. raw_data stores the full body as
--    received; field_data stores only the mapped form fields. crm_contact_id
--    is set when the lead has been promoted to a CRM contact.
-- ----------------------------------------------------------------------------
CREATE TABLE public.prospect_leads (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id      UUID        NOT NULL REFERENCES public.prospect_sources(id) ON DELETE CASCADE,
  organization_id UUID       NOT NULL,
  raw_data       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  field_data     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  crm_contact_id UUID        NULL,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_prospect_leads_source_id
  ON public.prospect_leads(source_id);

CREATE INDEX idx_prospect_leads_organization_id
  ON public.prospect_leads(organization_id);

CREATE INDEX idx_prospect_leads_received_at
  ON public.prospect_leads(received_at DESC);

-- updated_at trigger — reuses the project-wide function, no new function created
CREATE TRIGGER trg_prospect_leads_updated_at
BEFORE UPDATE ON public.prospect_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.prospect_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their prospect leads"
ON public.prospect_leads FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can insert their prospect leads"
ON public.prospect_leads FOR INSERT
TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can update their prospect leads"
ON public.prospect_leads FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can delete their prospect leads"
ON public.prospect_leads FOR DELETE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));
