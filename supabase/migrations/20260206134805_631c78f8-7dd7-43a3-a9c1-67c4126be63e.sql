-- Adicionar coluna is_popular a tabela subscription_plans
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT FALSE;

-- Migrar dados existentes (planos com highlight_label "Mais Popular")
UPDATE subscription_plans 
SET is_popular = TRUE 
WHERE highlight_label = 'Mais Popular';