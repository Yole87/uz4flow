-- Fix the overly permissive INSERT policy
-- Drop the existing policy and create a more restrictive one
DROP POLICY IF EXISTS "Service role can insert events" ON crm_webhook_events;

-- Edge functions use service_role which bypasses RLS anyway
-- For authenticated users, only allow insert if they belong to the org
CREATE POLICY "Users can insert their org events"
  ON crm_webhook_events FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));