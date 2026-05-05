-- Fix: restrict subscription_plans SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view public active plans" ON public.subscription_plans;

CREATE POLICY "Authenticated users can view active plans"
ON public.subscription_plans
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = true
  AND is_public = true
);
