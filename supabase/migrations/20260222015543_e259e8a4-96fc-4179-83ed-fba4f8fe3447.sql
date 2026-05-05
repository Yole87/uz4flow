
-- Trigger: create default pipeline "Funil de Vendas" when a new organization is created
CREATE OR REPLACE FUNCTION public.create_default_pipeline_for_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline_id uuid;
BEGIN
  -- Create the default pipeline
  INSERT INTO public.pipelines (organization_id, name, description, is_default)
  VALUES (NEW.id, 'Funil de Vendas', 'Pipeline padrão de vendas', true)
  RETURNING id INTO v_pipeline_id;

  -- Create the 5 default stages with descriptions
  INSERT INTO public.stages (pipeline_id, name, color, order_index, description) VALUES
    (v_pipeline_id, 'Novo Lead', '#71717a', 0, 'Lead recém-chegado, aguardando primeiro contato'),
    (v_pipeline_id, 'Em Progresso', '#3b82f6', 1, 'Contato em andamento, qualificando interesse'),
    (v_pipeline_id, 'Negociação', '#f97316', 2, 'Proposta enviada, em fase de negociação'),
    (v_pipeline_id, 'Fechado', '#22c55e', 3, 'Venda concluída com sucesso'),
    (v_pipeline_id, 'Perdido', '#ef4444', 4, 'Lead perdido ou desistiu da compra');

  RETURN NEW;
END;
$function$;

-- Attach trigger to organizations table
CREATE TRIGGER trg_create_default_pipeline
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.create_default_pipeline_for_org();

-- Also update existing stages that don't have descriptions yet
UPDATE public.stages SET description = 'Lead recém-chegado, aguardando primeiro contato' WHERE name = 'Novo Lead' AND description IS NULL;
UPDATE public.stages SET description = 'Contato em andamento, qualificando interesse' WHERE name = 'Em Progresso' AND description IS NULL;
UPDATE public.stages SET description = 'Proposta enviada, em fase de negociação' WHERE name = 'Negociação' AND description IS NULL;
UPDATE public.stages SET description = 'Venda concluída com sucesso' WHERE name = 'Fechado' AND description IS NULL;
UPDATE public.stages SET description = 'Lead perdido ou desistiu da compra' WHERE name = 'Perdido' AND description IS NULL;
