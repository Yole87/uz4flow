CREATE OR REPLACE FUNCTION public.can_manage_organization(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = _org_id
      AND (
        o.owner_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin_master')
      )
  );
$$;

DROP POLICY IF EXISTS "Owners can update their organizations" ON public.organizations;

CREATE POLICY "Users can update manageable organizations"
ON public.organizations
FOR UPDATE
TO authenticated
USING (public.can_manage_organization(id))
WITH CHECK (public.can_manage_organization(id));

ALTER TABLE public.billing_notifications_log
DROP CONSTRAINT IF EXISTS billing_notifications_log_organization_id_fkey;

ALTER TABLE public.billing_notifications_log
ADD CONSTRAINT billing_notifications_log_organization_id_fkey
FOREIGN KEY (organization_id)
REFERENCES public.organizations(id)
ON DELETE SET NULL;

ALTER TABLE public.voice_calls
DROP CONSTRAINT IF EXISTS voice_calls_organization_id_fkey;

ALTER TABLE public.voice_calls
ADD CONSTRAINT voice_calls_organization_id_fkey
FOREIGN KEY (organization_id)
REFERENCES public.organizations(id)
ON DELETE CASCADE;

ALTER TABLE public.voice_campaigns
DROP CONSTRAINT IF EXISTS voice_campaigns_organization_id_fkey;

ALTER TABLE public.voice_campaigns
ADD CONSTRAINT voice_campaigns_organization_id_fkey
FOREIGN KEY (organization_id)
REFERENCES public.organizations(id)
ON DELETE CASCADE;