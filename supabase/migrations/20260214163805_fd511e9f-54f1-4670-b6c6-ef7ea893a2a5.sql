
-- Tabela de configuração de rotação de leads
CREATE TABLE public.lead_rotation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_profile_id uuid NOT NULL REFERENCES public.team_profiles(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  keyword_filter text,
  target_pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  last_assigned_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_lead_rotation_config_updated_at
BEFORE UPDATE ON public.lead_rotation_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lead_rotation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org rotation config"
ON public.lead_rotation_config FOR SELECT TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org owners can manage rotation config"
ON public.lead_rotation_config FOR ALL TO authenticated
USING (public.is_organization_owner(organization_id, auth.uid()))
WITH CHECK (public.is_organization_owner(organization_id, auth.uid()));

-- Adicionar assigned_to_member_id em contacts
ALTER TABLE public.contacts ADD COLUMN assigned_to_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX idx_lead_rotation_org ON public.lead_rotation_config(organization_id, is_enabled);
CREATE INDEX idx_contacts_assigned ON public.contacts(assigned_to_member_id);
