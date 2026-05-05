
-- Tabela de regras de roteamento por palavra-chave
CREATE TABLE public.pipeline_keyword_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  match_mode text NOT NULL DEFAULT 'contains',
  target_pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  target_stage_id uuid NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  priority int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  apply_on text NOT NULL DEFAULT 'first_message',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for match_mode
CREATE OR REPLACE FUNCTION public.validate_keyword_rule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.match_mode NOT IN ('contains', 'exact') THEN
    RAISE EXCEPTION 'match_mode must be contains or exact';
  END IF;
  IF NEW.apply_on NOT IN ('first_message', 'any_message') THEN
    RAISE EXCEPTION 'apply_on must be first_message or any_message';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_keyword_rule_trigger
BEFORE INSERT OR UPDATE ON public.pipeline_keyword_rules
FOR EACH ROW EXECUTE FUNCTION public.validate_keyword_rule();

-- Updated_at trigger
CREATE TRIGGER update_pipeline_keyword_rules_updated_at
BEFORE UPDATE ON public.pipeline_keyword_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.pipeline_keyword_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org keyword rules"
ON public.pipeline_keyword_rules FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can insert org keyword rules"
ON public.pipeline_keyword_rules FOR INSERT
TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can update org keyword rules"
ON public.pipeline_keyword_rules FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can delete org keyword rules"
ON public.pipeline_keyword_rules FOR DELETE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

-- Index for performance
CREATE INDEX idx_keyword_rules_org_active ON public.pipeline_keyword_rules(organization_id, is_active);
