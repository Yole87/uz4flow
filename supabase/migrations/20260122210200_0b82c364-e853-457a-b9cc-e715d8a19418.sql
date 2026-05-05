-- 1. Criar funções helper para evitar recursão (se não existirem)
CREATE OR REPLACE FUNCTION public.get_user_organization_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_organization_owner(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations 
    WHERE id = _org_id AND owner_user_id = _user_id
  )
$$;

-- 2. Remover políticas problemáticas de organizations
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
DROP POLICY IF EXISTS "Owner can update their organization" ON organizations;

-- 3. Remover políticas problemáticas de organization_members
DROP POLICY IF EXISTS "Members can view their organization members" ON organization_members;
DROP POLICY IF EXISTS "Organization owner can manage members" ON organization_members;

-- 4. Novas políticas para organizations (INSERT que estava faltando!)
CREATE POLICY "Users can create their own organizations"
ON organizations FOR INSERT
WITH CHECK (owner_user_id = auth.uid());

-- 5. Novas políticas para organization_members (INSERT para o próprio usuário)
CREATE POLICY "Users can add themselves to organizations"
ON organization_members FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own memberships"
ON organization_members FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Owners can manage all organization members"
ON organization_members FOR ALL
USING (public.is_organization_owner(organization_id, auth.uid()))
WITH CHECK (public.is_organization_owner(organization_id, auth.uid()));