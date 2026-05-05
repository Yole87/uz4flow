-- Adicionar policy de SELECT para organizations (faltava!)
-- Owner pode ver sua organização
CREATE POLICY "Owner can view their organization"
ON organizations FOR SELECT
USING (owner_user_id = auth.uid());

-- Membros podem ver organizações das quais fazem parte (sem recursão)
CREATE POLICY "Members can view their organization"
ON organizations FOR SELECT
USING (id IN (SELECT public.get_user_organization_ids(auth.uid())));

-- Owner pode atualizar sua organização
CREATE POLICY "Owner can update their organization"
ON organizations FOR UPDATE
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());