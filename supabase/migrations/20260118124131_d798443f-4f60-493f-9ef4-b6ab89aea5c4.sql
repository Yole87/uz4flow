-- =====================================================
-- FLUXOS INTERATIVOS COM COLETA DE DADOS
-- =====================================================

-- 1. Novas colunas na tabela flows
ALTER TABLE public.flows
ADD COLUMN IF NOT EXISTS is_interactive boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS session_timeout_minutes integer NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS timeout_action text NOT NULL DEFAULT 'end',
ADD COLUMN IF NOT EXISTS timeout_message text;

-- 2. Novas colunas na tabela flow_steps
ALTER TABLE public.flow_steps
ADD COLUMN IF NOT EXISTS requires_response boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS variable_name text,
ADD COLUMN IF NOT EXISTS validation_type text NOT NULL DEFAULT 'any',
ADD COLUMN IF NOT EXISTS invalid_response_message text,
ADD COLUMN IF NOT EXISTS step_timeout_minutes integer,
ADD COLUMN IF NOT EXISTS accept_file_response boolean NOT NULL DEFAULT false;

-- 3. Nova tabela: flow_sessions (sessões de conversa interativa)
CREATE TABLE IF NOT EXISTS public.flow_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  instance_id text NOT NULL,
  push_name text,
  current_step_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  collected_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  last_activity_at timestamp with time zone NOT NULL DEFAULT now(),
  timeout_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraint única para evitar sessões duplicadas ativas
  CONSTRAINT unique_active_session UNIQUE (flow_id, chat_id, instance_id)
);

-- 4. Nova tabela: session_responses (respostas individuais coletadas)
CREATE TABLE IF NOT EXISTS public.session_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.flow_sessions(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.flow_steps(id) ON DELETE SET NULL,
  step_index integer NOT NULL,
  variable_name text NOT NULL,
  response_type text NOT NULL DEFAULT 'text',
  response_text text,
  file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  is_valid boolean NOT NULL DEFAULT true,
  validation_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_flow_sessions_status ON public.flow_sessions(status);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_timeout ON public.flow_sessions(timeout_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_flow_sessions_user ON public.flow_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_flow ON public.flow_sessions(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_chat ON public.flow_sessions(chat_id, instance_id);
CREATE INDEX IF NOT EXISTS idx_session_responses_session ON public.session_responses(session_id);

-- 6. Enable RLS
ALTER TABLE public.flow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_responses ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies para flow_sessions
CREATE POLICY "Users can view their own flow sessions"
ON public.flow_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flow sessions"
ON public.flow_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flow sessions"
ON public.flow_sessions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flow sessions"
ON public.flow_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- 8. RLS policies para session_responses (via sessão)
CREATE POLICY "Users can view their own session responses"
ON public.session_responses
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.flow_sessions
  WHERE flow_sessions.id = session_responses.session_id
  AND flow_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own session responses"
ON public.session_responses
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.flow_sessions
  WHERE flow_sessions.id = session_responses.session_id
  AND flow_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can update their own session responses"
ON public.session_responses
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.flow_sessions
  WHERE flow_sessions.id = session_responses.session_id
  AND flow_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own session responses"
ON public.session_responses
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.flow_sessions
  WHERE flow_sessions.id = session_responses.session_id
  AND flow_sessions.user_id = auth.uid()
));

-- 9. Trigger para atualizar updated_at nas novas tabelas
CREATE TRIGGER update_flow_sessions_updated_at
BEFORE UPDATE ON public.flow_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Adicionar coluna updated_at na flow_sessions se não existir
ALTER TABLE public.flow_sessions
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();