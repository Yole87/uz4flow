-- Estende user_onboarding com rastreio de passos individuais
ALTER TABLE public.user_onboarding
  ADD COLUMN IF NOT EXISTS steps jsonb NOT NULL DEFAULT '{
    "connect_whatsapp": false,
    "configure_kanban": false,
    "create_first_flow": false,
    "invite_team": false,
    "import_contacts": false
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS dismissed_checklist boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();

-- Estende tutorial_categories com slug
ALTER TABLE public.tutorial_categories
  ADD COLUMN IF NOT EXISTS slug text;

-- Backfill slugs a partir do nome (lowercase, sem acentos básicos, hífen)
UPDATE public.tutorial_categories
SET slug = lower(regexp_replace(
  translate(name,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  ),
  '[^a-zA-Z0-9]+', '-', 'g'
))
WHERE slug IS NULL;

-- Constraint de unicidade (apenas se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tutorial_categories_slug_unique'
  ) THEN
    ALTER TABLE public.tutorial_categories
      ADD CONSTRAINT tutorial_categories_slug_unique UNIQUE(slug);
  END IF;
END $$;

-- Estende tutorials
ALTER TABLE public.tutorials
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS module_slug text,
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS doc_link text;

-- Garante que difficulty fica num conjunto válido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tutorials_difficulty_check'
  ) THEN
    ALTER TABLE public.tutorials
      ADD CONSTRAINT tutorials_difficulty_check
      CHECK (difficulty IN ('beginner','intermediate','advanced'));
  END IF;
END $$;

-- Index de busca por module_slug
CREATE INDEX IF NOT EXISTS tutorials_module_slug_idx ON public.tutorials(module_slug);
CREATE INDEX IF NOT EXISTS tutorials_tags_idx ON public.tutorials USING GIN(tags);