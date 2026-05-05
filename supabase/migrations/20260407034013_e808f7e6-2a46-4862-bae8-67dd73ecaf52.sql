
-- Tabela de configuração de IA por organização
CREATE TABLE public.organization_ai_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  gemini_api_key_encrypted TEXT,
  default_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_ai_configs ENABLE ROW LEVEL SECURITY;

-- Policies: only org owner or admin_master
CREATE POLICY "Org owners can view their AI config"
  ON public.organization_ai_configs FOR SELECT
  TO authenticated
  USING (
    public.is_organization_owner(organization_id, auth.uid())
    OR public.is_admin_master()
  );

CREATE POLICY "Org owners can insert their AI config"
  ON public.organization_ai_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_organization_owner(organization_id, auth.uid())
    OR public.is_admin_master()
  );

CREATE POLICY "Org owners can update their AI config"
  ON public.organization_ai_configs FOR UPDATE
  TO authenticated
  USING (
    public.is_organization_owner(organization_id, auth.uid())
    OR public.is_admin_master()
  )
  WITH CHECK (
    public.is_organization_owner(organization_id, auth.uid())
    OR public.is_admin_master()
  );

CREATE POLICY "Org owners can delete their AI config"
  ON public.organization_ai_configs FOR DELETE
  TO authenticated
  USING (
    public.is_organization_owner(organization_id, auth.uid())
    OR public.is_admin_master()
  );

-- Trigger for updated_at
CREATE TRIGGER update_organization_ai_configs_updated_at
  BEFORE UPDATE ON public.organization_ai_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
