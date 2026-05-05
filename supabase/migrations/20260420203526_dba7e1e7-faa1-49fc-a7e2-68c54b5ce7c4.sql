-- Feature 2: Equipe expandida
-- Adiciona departamento aos perfis (separado do nome do perfil)
ALTER TABLE public.team_profiles 
  ADD COLUMN IF NOT EXISTS department text;

-- Migrar dados: usar o "name" atual como departamento se vazio
UPDATE public.team_profiles 
SET department = COALESCE(department, name)
WHERE department IS NULL;

-- Adiciona formato de assinatura nos membros
ALTER TABLE public.team_members 
  ADD COLUMN IF NOT EXISTS signature_format text NOT NULL DEFAULT 'name_role_dept',
  ADD COLUMN IF NOT EXISTS silent_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Validação do formato de assinatura
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_members_signature_format_check'
  ) THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_signature_format_check
      CHECK (signature_format IN ('name_only', 'name_role', 'name_role_dept', 'none'));
  END IF;
END $$;

-- Toggle global de assinatura na organização
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS message_signature_enabled boolean NOT NULL DEFAULT true;