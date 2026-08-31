# Plano: Criar tabela google_calendar_credentials

## Objetivo
Aplicar ao banco de dados o schema da tabela `public.google_calendar_credentials`, que está pendente após push via GitHub, e confirmar sua criação.

## O que será feito
1. Criar e executar uma migration com o SQL fornecido pelo usuário.
2. Verificar que a tabela foi criada com sucesso.

## SQL da migration
```sql
CREATE TABLE IF NOT EXISTS public.google_calendar_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.google_calendar_credentials TO service_role;

ALTER TABLE public.google_calendar_credentials ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_google_calendar_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_google_calendar_credentials_updated_at
  BEFORE UPDATE ON public.google_calendar_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_google_calendar_credentials_updated_at();
```

## Verificação
Após a migration, executar:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'google_calendar_credentials';
```

## Escopo
- Nenhum código da aplicação será alterado.
- Apenas a estrutura do banco de dados será atualizada.
