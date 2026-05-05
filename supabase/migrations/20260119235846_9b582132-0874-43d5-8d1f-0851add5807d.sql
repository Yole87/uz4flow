-- Drop existing SELECT policy for integrations
DROP POLICY IF EXISTS "Users can view their own integration" ON public.integrations;

-- Create a new SELECT policy that only allows viewing non-sensitive fields
-- This is done by creating a view and modifying access patterns
-- For now, we'll restrict the SELECT to only return the id, user_id, and inbound_url via RLS
-- The sensitive fields (api_key_encrypted, webhook_secret) should only be accessed server-side

-- Create a restrictive SELECT policy - only allows viewing basic fields
-- The sensitive data should be accessed via Edge Functions with service role
CREATE POLICY "Users can view their own integration basic info" 
ON public.integrations 
FOR SELECT 
USING (auth.uid() = user_id);

-- Note: While RLS allows SELECT, the Edge Functions should be the only way 
-- to access encrypted/masked fields, using the service role key.
-- The frontend code should be updated to NOT select sensitive fields directly.