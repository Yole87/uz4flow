-- Tabela para armazenar o segredo dos cron jobs
CREATE TABLE IF NOT EXISTS public.cron_secrets (
  id text PRIMARY KEY,
  secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_secrets ENABLE ROW LEVEL SECURITY;

-- Bloqueia totalmente o acesso via RLS (somente service_role bypassa RLS)
DROP POLICY IF EXISTS "Deny all access to cron_secrets" ON public.cron_secrets;
CREATE POLICY "Deny all access to cron_secrets"
ON public.cron_secrets
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- Função SECURITY DEFINER para os cron jobs lerem o segredo
CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT secret FROM public.cron_secrets WHERE id = 'default' LIMIT 1
$$;

-- Restringe execução da função: apenas service_role e postgres
REVOKE ALL ON FUNCTION public.get_cron_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_cron_secret() FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_cron_secret() TO postgres, service_role;

-- Gera e armazena o segredo
INSERT INTO public.cron_secrets (id, secret)
VALUES ('default', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO UPDATE
  SET secret = encode(gen_random_bytes(32), 'hex'),
      updated_at = now();

-- Exibe o valor uma única vez para você copiar
SELECT secret AS cron_secret_to_copy
FROM public.cron_secrets
WHERE id = 'default';