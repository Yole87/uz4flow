-- ============================================================
-- FASE 1: Índices Compostos para Alta Performance
-- ============================================================

-- Índice para ordenação de mensagens por conversa (CRM)
CREATE INDEX IF NOT EXISTS idx_messages_conv_timestamp 
ON messages(conversation_id, timestamp DESC);

-- Índice para lista de contatos ordenada por última interação
CREATE INDEX IF NOT EXISTS idx_contacts_org_interaction 
ON contacts(organization_id, last_interaction_at DESC NULLS LAST);

-- Índice para painel de conversas
CREATE INDEX IF NOT EXISTS idx_conversations_contact_status 
ON conversations(contact_id, status, last_message_at DESC NULLS LAST);

-- Índice para lookup de sessões ativas (Flow Engine - crítico para webhooks)
CREATE INDEX IF NOT EXISTS idx_flow_sessions_lookup 
ON flow_sessions(chat_id, instance_id, status);

-- Índice para histórico de eventos por usuário
CREATE INDEX IF NOT EXISTS idx_events_user_created 
ON events(user_id, created_at DESC);

-- Índice para regras de roteamento ativas
CREATE INDEX IF NOT EXISTS idx_routing_rules_user_active 
ON routing_rules(user_id, priority);

-- Índice para organization_members (usado em TODA RLS)
CREATE INDEX IF NOT EXISTS idx_org_members_user_org 
ON organization_members(user_id, organization_id);

-- Índice para connector_events
CREATE INDEX IF NOT EXISTS idx_connector_events_user_created 
ON connector_events(user_id, created_at DESC);

-- ============================================================
-- FASE 2: Desnormalização de organization_id em messages
-- ============================================================

-- Adicionar coluna organization_id para evitar JOINs em RLS
ALTER TABLE messages ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Criar índice para a nova coluna
CREATE INDEX IF NOT EXISTS idx_messages_org_timestamp 
ON messages(organization_id, timestamp DESC);

-- Trigger para popular organization_id automaticamente em novos registros
CREATE OR REPLACE FUNCTION public.set_message_organization()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT c.organization_id INTO NEW.organization_id
  FROM conversations conv
  JOIN contacts c ON c.id = conv.contact_id
  WHERE conv.id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS trigger_set_message_organization ON messages;

-- Criar trigger para novos inserts
CREATE TRIGGER trigger_set_message_organization
BEFORE INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION public.set_message_organization();

-- Popular dados existentes (para mensagens já criadas)
UPDATE messages m
SET organization_id = (
  SELECT c.organization_id
  FROM conversations conv
  JOIN contacts c ON c.id = conv.contact_id
  WHERE conv.id = m.conversation_id
)
WHERE m.organization_id IS NULL;

-- ============================================================
-- FASE 3: RLS Simplificada para Messages (muito mais rápida)
-- ============================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view messages of their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON messages;

-- Criar novas políticas otimizadas usando organization_id diretamente
CREATE POLICY "Users can view their organization messages" 
ON messages FOR SELECT 
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their organization messages" 
ON messages FOR INSERT 
WITH CHECK (
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  OR organization_id IS NULL
);

CREATE POLICY "Users can update their organization messages" 
ON messages FOR UPDATE 
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their organization messages" 
ON messages FOR DELETE 
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- ============================================================
-- FASE 4: Função RPC para Webhook (batch de queries)
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_webhook_init(
  p_user_id UUID,
  p_chat_id TEXT,
  p_instance_id TEXT,
  p_message_id TEXT,
  p_message_text TEXT,
  p_push_name TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_session RECORD;
  v_rules JSONB;
  v_event_id UUID;
  v_default_flow RECORD;
BEGIN
  -- 1. Verificar sessão ativa (query única)
  SELECT id, flow_id, current_step_index, collected_data, status
  INTO v_active_session
  FROM flow_sessions
  WHERE user_id = p_user_id
    AND chat_id = p_chat_id
    AND instance_id = p_instance_id
    AND status = 'active'
  LIMIT 1;

  -- 2. Buscar regras de roteamento (query única)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'flow_id', r.flow_id,
      'match_type', r.match_type,
      'match_value', r.match_value,
      'priority', r.priority,
      'instance_id', r.instance_id
    ) ORDER BY r.priority
  ) INTO v_rules
  FROM routing_rules r
  WHERE r.user_id = p_user_id
    AND r.is_active = true;

  -- 3. Buscar flow default se não houver regras
  IF v_rules IS NULL OR jsonb_array_length(v_rules) = 0 THEN
    SELECT id, name INTO v_default_flow
    FROM flows
    WHERE user_id = p_user_id AND is_default = true AND is_active = true
    LIMIT 1;
  END IF;

  -- 4. Criar evento
  INSERT INTO events (
    user_id, chat_id, instance_id, message_id,
    message_text, push_name, received_payload_json, status
  ) VALUES (
    p_user_id, p_chat_id, p_instance_id, p_message_id,
    p_message_text, p_push_name, p_payload, 'pending'
  )
  RETURNING id INTO v_event_id;

  -- 5. Retornar tudo em uma única resposta
  RETURN jsonb_build_object(
    'event_id', v_event_id,
    'has_active_session', v_active_session IS NOT NULL,
    'active_session', CASE 
      WHEN v_active_session IS NOT NULL THEN
        jsonb_build_object(
          'id', v_active_session.id,
          'flow_id', v_active_session.flow_id,
          'current_step_index', v_active_session.current_step_index,
          'collected_data', v_active_session.collected_data
        )
      ELSE NULL
    END,
    'routing_rules', COALESCE(v_rules, '[]'::jsonb),
    'default_flow', CASE 
      WHEN v_default_flow IS NOT NULL THEN
        jsonb_build_object('id', v_default_flow.id, 'name', v_default_flow.name)
      ELSE NULL
    END
  );
END;
$$;