CREATE POLICY "Anyone can view active public plans"
ON public.subscription_plans
FOR SELECT
USING (is_active = true AND is_public = true);