-- 1. Criar ENUM para sender_type
CREATE TYPE message_sender_type AS ENUM ('customer', 'ia', 'attendant');

-- 2. Adicionar campo openbot_instance_id na tabela instances
ALTER TABLE instances ADD COLUMN IF NOT EXISTS openbot_instance_id TEXT UNIQUE;

-- 3. Adicionar novos campos na tabela messages
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS sender_type message_sender_type DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS openbot_message_id TEXT;

-- 4. Criar índice otimizado para busca por organization + conversation
CREATE INDEX IF NOT EXISTS idx_messages_org_conv 
  ON messages(organization_id, conversation_id) 
  WHERE organization_id IS NOT NULL;

-- 5. Adicionar campo last_sender_type na tabela conversations para indicador visual
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS last_sender_type message_sender_type DEFAULT 'customer';

-- 6. Criar tabela de configuração do OpenBot por organização
CREATE TABLE crm_openbot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  openbot_api_key_encrypted TEXT,
  openbot_send_url TEXT NOT NULL DEFAULT 'https://api.openbot.io/v1/send',
  webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- 7. Habilitar RLS na tabela crm_openbot_config
ALTER TABLE crm_openbot_config ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS para crm_openbot_config
CREATE POLICY "Users can view their org config" ON crm_openbot_config
  FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their org config" ON crm_openbot_config
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can update their org config" ON crm_openbot_config
  FOR UPDATE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their org config" ON crm_openbot_config
  FOR DELETE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- 9. Trigger para updated_at
CREATE TRIGGER update_crm_openbot_config_updated_at
  BEFORE UPDATE ON crm_openbot_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();