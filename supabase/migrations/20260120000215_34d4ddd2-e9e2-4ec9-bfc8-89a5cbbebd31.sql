-- Tabela para armazenar rate limits
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida
CREATE INDEX idx_rate_limits_lookup 
ON public.rate_limits (identifier, endpoint, window_start);

-- Função para limpar registros antigos
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits 
  WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;

-- RLS: Somente service role pode acessar (nenhuma policy = bloqueado para usuários normais)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;