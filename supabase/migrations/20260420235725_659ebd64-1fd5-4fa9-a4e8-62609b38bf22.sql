-- 1. Adicionar coluna organization_id se não existir
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Índice para performance
CREATE INDEX IF NOT EXISTS idx_files_organization_id ON public.files(organization_id);

-- 3. Backfill: para registros sem org, buscar via organization_members ou owner_user_id
UPDATE public.files f
SET organization_id = sub.org_id
FROM (
  SELECT 
    f2.id AS file_id,
    COALESCE(
      (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = f2.user_id LIMIT 1),
      (SELECT o.id FROM public.organizations o WHERE o.owner_user_id = f2.user_id LIMIT 1)
    ) AS org_id
  FROM public.files f2
  WHERE f2.organization_id IS NULL
) sub
WHERE f.id = sub.file_id AND sub.org_id IS NOT NULL;