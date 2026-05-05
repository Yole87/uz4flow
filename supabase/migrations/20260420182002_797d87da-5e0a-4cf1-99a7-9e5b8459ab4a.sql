-- Permitir que membros da organização (não apenas owners) possam VER as instâncias do WhatsApp/Instagram
-- usadas no dia-a-dia. INSERT/UPDATE/DELETE permanecem restritos a owners e admin_master.

CREATE POLICY "Members can view their org instances"
ON public.instances
FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));