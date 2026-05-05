
-- ==========================================
-- FASE 1: Correções Críticas de Segurança
-- ==========================================

-- 1.1 rate_limits: Bloquear acesso a usuários comuns (RLS já está enabled, mas sem policies)
CREATE POLICY "Deny all access to rate_limits"
ON public.rate_limits FOR ALL
TO authenticated USING (false);

-- 1.2 instances_safe: Recriar como SECURITY INVOKER
DROP VIEW IF EXISTS public.instances_safe;
CREATE VIEW public.instances_safe
WITH (security_invoker = true) AS
SELECT id,
    organization_id,
    name,
    provider,
    phone_number,
    status,
    qr_code,
    webhook_url,
    api_url,
    openbot_instance_id,
    created_at,
    updated_at,
    (api_key_encrypted IS NOT NULL) AS has_api_key,
    (openbot_api_key_encrypted IS NOT NULL) AS has_openbot_api_key
FROM instances;

-- Add RLS-like policy via the underlying table:
-- The instances table already has "Deny direct SELECT on instances" policy.
-- We need a SELECT policy that allows org members to read via the view.
-- Since SECURITY INVOKER means the view runs as the calling user,
-- we need to allow SELECT on instances for org members.
DROP POLICY IF EXISTS "Deny direct SELECT on instances" ON public.instances;
CREATE POLICY "Users can view their organization instances via view"
ON public.instances FOR SELECT
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- ==========================================
-- FASE 2: RLS Moderadas
-- ==========================================

-- 2.1 subscription_payments: Already has org-member based SELECT and admin policy.
-- Restrict to org owner only for regular users
DROP POLICY IF EXISTS "Users can view their organization payments" ON public.subscription_payments;
CREATE POLICY "Org owners can view their organization payments"
ON public.subscription_payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = subscription_payments.organization_id
    AND o.owner_user_id = auth.uid()
  )
);

-- 2.2 contact_notes: Restrict UPDATE/DELETE to author only
DROP POLICY IF EXISTS "Users can update their org contact notes" ON public.contact_notes;
CREATE POLICY "Users can update their own notes"
ON public.contact_notes FOR UPDATE
USING (author_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their org contact notes" ON public.contact_notes;
CREATE POLICY "Users can delete their own notes"
ON public.contact_notes FOR DELETE
USING (author_user_id = auth.uid());

-- 2.3 conversations: Restrict assigned_to changes to org owners
-- We keep the existing UPDATE policy but add a trigger to validate assigned_to changes
CREATE OR REPLACE FUNCTION public.validate_conversation_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If assigned_to is being changed, verify the user is an org owner
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    -- Get the organization_id from the contact
    DECLARE
      v_org_id uuid;
    BEGIN
      SELECT c.organization_id INTO v_org_id
      FROM contacts c WHERE c.id = NEW.contact_id;
      
      -- Allow if user is org owner or admin_master
      IF NOT (
        is_organization_owner(v_org_id, auth.uid()) 
        OR is_admin_master()
      ) THEN
        RAISE EXCEPTION 'Only organization owners can reassign conversations';
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_conversation_assignment_trigger
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.validate_conversation_assignment();

-- ==========================================
-- mcp_connections: Add encrypted columns for OAuth tokens
-- ==========================================
ALTER TABLE public.mcp_connections 
  ADD COLUMN IF NOT EXISTS access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted text;
