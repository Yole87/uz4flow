DROP POLICY IF EXISTS "Users can update manageable organizations" ON public.organizations;
DROP FUNCTION IF EXISTS public.can_manage_organization(uuid);

CREATE POLICY "Users can update manageable organizations"
ON public.organizations
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin_master'))
WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin_master'));