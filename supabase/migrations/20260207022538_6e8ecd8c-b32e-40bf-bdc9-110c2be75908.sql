-- Adicionar campo description nas stages para notas/descrições das colunas
ALTER TABLE public.stages ADD COLUMN IF NOT EXISTS description text;