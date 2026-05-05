
-- Tabela de perfis de equipe (roles/cargos)
CREATE TABLE public.team_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_team_profiles_updated_at
BEFORE UPDATE ON public.team_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.team_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org team profiles"
ON public.team_profiles FOR SELECT TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org owners can manage team profiles"
ON public.team_profiles FOR INSERT TO authenticated
WITH CHECK (public.is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Org owners can update team profiles"
ON public.team_profiles FOR UPDATE TO authenticated
USING (public.is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Org owners can delete team profiles"
ON public.team_profiles FOR DELETE TO authenticated
USING (public.is_organization_owner(organization_id, auth.uid()));

-- Tabela de membros da equipe
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  team_profile_id uuid NOT NULL REFERENCES public.team_profiles(id) ON DELETE RESTRICT,
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  deactivation_reason text,
  reactivation_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org team members"
ON public.team_members FOR SELECT TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Org owners can manage team members"
ON public.team_members FOR ALL TO authenticated
USING (public.is_organization_owner(organization_id, auth.uid()))
WITH CHECK (public.is_organization_owner(organization_id, auth.uid()));

-- Indexes
CREATE INDEX idx_team_members_org ON public.team_members(organization_id, is_active);
CREATE INDEX idx_team_profiles_org ON public.team_profiles(organization_id);
