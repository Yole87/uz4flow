-- =============================================================================
-- Uz Forms Module
-- Creates tables for customizable multi-step forms.
-- Scoped via get_user_organization_ids.
-- =============================================================================

-- PART 1 — Add soft delete to prospect_sources
ALTER TABLE public.prospect_sources 
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;


-- PART 2 — Create the 4 new tables

-- ----------------------------------------------------------------------------
-- 1. uz_forms
-- ----------------------------------------------------------------------------
CREATE TABLE public.uz_forms (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL,
  token           TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  is_deleted      BOOLEAN     NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ NULL,
  settings        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- Indexes
CREATE INDEX idx_uz_forms_organization_id ON public.uz_forms(organization_id);
CREATE INDEX idx_uz_forms_token ON public.uz_forms(token);

-- updated_at trigger
CREATE TRIGGER trg_uz_forms_updated_at
BEFORE UPDATE ON public.uz_forms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.uz_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their uz forms"
ON public.uz_forms FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can insert their uz forms"
ON public.uz_forms FOR INSERT
TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can update their uz forms"
ON public.uz_forms FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can delete their uz forms"
ON public.uz_forms FOR DELETE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));


-- ----------------------------------------------------------------------------
-- 2. uz_form_steps
-- ----------------------------------------------------------------------------
CREATE TABLE public.uz_form_steps (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id     UUID        NOT NULL REFERENCES public.uz_forms(id) ON DELETE CASCADE,
  step_order  INTEGER     NOT NULL DEFAULT 0,
  title       TEXT        NULL,
  description TEXT        NULL,
  media_type  TEXT        NOT NULL DEFAULT 'none' CHECK (media_type IN ('none', 'image', 'youtube')),
  media_url   TEXT        NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE TRIGGER trg_uz_form_steps_updated_at
BEFORE UPDATE ON public.uz_form_steps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.uz_form_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their uz form steps"
ON public.uz_form_steps FOR SELECT
TO authenticated
USING (
  form_id IN (
    SELECT id FROM public.uz_forms
    WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Org members can insert their uz form steps"
ON public.uz_form_steps FOR INSERT
TO authenticated
WITH CHECK (
  form_id IN (
    SELECT id FROM public.uz_forms
    WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Org members can update their uz form steps"
ON public.uz_form_steps FOR UPDATE
TO authenticated
USING (
  form_id IN (
    SELECT id FROM public.uz_forms
    WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Org members can delete their uz form steps"
ON public.uz_form_steps FOR DELETE
TO authenticated
USING (
  form_id IN (
    SELECT id FROM public.uz_forms
    WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);


-- ----------------------------------------------------------------------------
-- 3. uz_form_fields
-- ----------------------------------------------------------------------------
CREATE TABLE public.uz_form_fields (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id     UUID        NOT NULL REFERENCES public.uz_form_steps(id) ON DELETE CASCADE,
  field_type  TEXT        NOT NULL CHECK (field_type IN ('name','email','phone','short_text','long_text','date','multiple_choice','select_list','file_upload','address','cpf','cnpj')),
  label       TEXT        NOT NULL,
  key_name    TEXT        NOT NULL,
  is_required BOOLEAN     NOT NULL DEFAULT false,
  options     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  field_order INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.uz_form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their uz form fields"
ON public.uz_form_fields FOR SELECT
TO authenticated
USING (
  step_id IN (
    SELECT s.id FROM public.uz_form_steps s
    JOIN public.uz_forms f ON s.form_id = f.id
    WHERE f.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Org members can insert their uz form fields"
ON public.uz_form_fields FOR INSERT
TO authenticated
WITH CHECK (
  step_id IN (
    SELECT s.id FROM public.uz_form_steps s
    JOIN public.uz_forms f ON s.form_id = f.id
    WHERE f.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Org members can update their uz form fields"
ON public.uz_form_fields FOR UPDATE
TO authenticated
USING (
  step_id IN (
    SELECT s.id FROM public.uz_form_steps s
    JOIN public.uz_forms f ON s.form_id = f.id
    WHERE f.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Org members can delete their uz form fields"
ON public.uz_form_fields FOR DELETE
TO authenticated
USING (
  step_id IN (
    SELECT s.id FROM public.uz_form_steps s
    JOIN public.uz_forms f ON s.form_id = f.id
    WHERE f.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);


-- ----------------------------------------------------------------------------
-- 4. uz_form_responses
-- ----------------------------------------------------------------------------
CREATE TABLE public.uz_form_responses (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id         UUID        NOT NULL REFERENCES public.uz_forms(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL,
  response_data   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address      TEXT        NULL,
  user_agent      TEXT        NULL
);

-- Indexes
CREATE INDEX idx_uz_form_responses_form_id ON public.uz_form_responses(form_id);
CREATE INDEX idx_uz_form_responses_organization_id ON public.uz_form_responses(organization_id);
CREATE INDEX idx_uz_form_responses_submitted_at ON public.uz_form_responses(submitted_at DESC);

-- RLS
ALTER TABLE public.uz_form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their uz form responses"
ON public.uz_form_responses FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can update their uz form responses"
ON public.uz_form_responses FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org members can delete their uz form responses"
ON public.uz_form_responses FOR DELETE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

-- Anonymous insert policy for public form submissions
CREATE POLICY "Anyone can insert uz form responses"
ON public.uz_form_responses FOR INSERT
WITH CHECK (true);
