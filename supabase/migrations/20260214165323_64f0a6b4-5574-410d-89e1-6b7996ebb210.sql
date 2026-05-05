
-- Restrict pipeline_keyword_rules write operations to organization owners only
-- Keep SELECT for all members

DROP POLICY IF EXISTS "Members can insert org keyword rules" ON public.pipeline_keyword_rules;
DROP POLICY IF EXISTS "Members can update org keyword rules" ON public.pipeline_keyword_rules;
DROP POLICY IF EXISTS "Members can delete org keyword rules" ON public.pipeline_keyword_rules;

CREATE POLICY "Owners can insert org keyword rules"
ON public.pipeline_keyword_rules
FOR INSERT
WITH CHECK (is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can update org keyword rules"
ON public.pipeline_keyword_rules
FOR UPDATE
USING (is_organization_owner(organization_id, auth.uid()));

CREATE POLICY "Owners can delete org keyword rules"
ON public.pipeline_keyword_rules
FOR DELETE
USING (is_organization_owner(organization_id, auth.uid()));
