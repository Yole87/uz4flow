CREATE POLICY "Users can update own onboarding"
ON public.user_onboarding FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);