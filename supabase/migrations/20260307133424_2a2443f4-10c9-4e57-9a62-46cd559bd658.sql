-- 1. Update get_user_organization_ids to bypass for admin_master
CREATE OR REPLACE FUNCTION public.get_user_organization_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin_master') THEN
    RETURN QUERY SELECT id FROM public.organizations;
  ELSE
    RETURN QUERY SELECT organization_id FROM public.organization_members WHERE user_id = _user_id;
  END IF;
END;
$$;

-- 2. Add admin_master bypass policy on instances table
CREATE POLICY "admin_master_full_access_instances"
ON public.instances
FOR ALL
TO authenticated
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());