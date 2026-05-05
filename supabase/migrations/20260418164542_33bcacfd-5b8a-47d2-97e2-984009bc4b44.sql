
-- Create contact_folders table
CREATE TABLE public.contact_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT 'Folder',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX idx_contact_folders_org ON public.contact_folders(organization_id, order_index);

ALTER TABLE public.contact_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view folders of their org"
  ON public.contact_folders FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    OR public.is_admin_master()
  );

CREATE POLICY "Members can create folders in their org"
  ON public.contact_folders FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  );

CREATE POLICY "Members can update folders of their org"
  ON public.contact_folders FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  );

CREATE POLICY "Members can delete folders of their org"
  ON public.contact_folders FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  );

CREATE TRIGGER update_contact_folders_updated_at
  BEFORE UPDATE ON public.contact_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Membership table (many-to-many: a contact can be in multiple folders)
CREATE TABLE public.contact_folder_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.contact_folders(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  added_by UUID,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (folder_id, contact_id)
);

CREATE INDEX idx_cfm_folder ON public.contact_folder_members(folder_id);
CREATE INDEX idx_cfm_contact ON public.contact_folder_members(contact_id);
CREATE INDEX idx_cfm_org ON public.contact_folder_members(organization_id);

ALTER TABLE public.contact_folder_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view folder memberships of their org"
  ON public.contact_folder_members FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    OR public.is_admin_master()
  );

CREATE POLICY "Members can add contacts to folders in their org"
  ON public.contact_folder_members FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  );

CREATE POLICY "Members can remove contacts from folders in their org"
  ON public.contact_folder_members FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  );
