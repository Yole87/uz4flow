-- 1. Remove sensitive tables from Realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.meta_conversation_windows;

-- 2. Restrict instagram_accounts SELECT to owners only (tokens are sensitive)
DROP POLICY IF EXISTS "Members can view their org instagram accounts" ON public.instagram_accounts;

CREATE POLICY "Owners can view their org instagram accounts"
ON public.instagram_accounts
FOR SELECT
TO authenticated
USING (
  is_admin_master()
  OR is_organization_owner(organization_id, auth.uid())
);