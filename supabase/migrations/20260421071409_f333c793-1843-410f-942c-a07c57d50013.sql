CREATE TABLE public.contact_import_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  errors_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  mapping_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  config_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'processing',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_import_history_org ON public.contact_import_history(organization_id, started_at DESC);

ALTER TABLE public.contact_import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view import history"
ON public.contact_import_history FOR SELECT
USING (
  organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  OR public.is_admin_master()
);

CREATE POLICY "Admin master full access import history"
ON public.contact_import_history FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

CREATE TRIGGER trg_update_contact_import_history_updated_at
BEFORE UPDATE ON public.contact_import_history
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();