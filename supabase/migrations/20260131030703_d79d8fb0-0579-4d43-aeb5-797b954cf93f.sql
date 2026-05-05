-- Create ENUM for WhatsApp provider types
CREATE TYPE public.whatsapp_provider AS ENUM ('evolution_api', 'meta_official');

-- Create ENUM for message direction
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');

-- Create ENUM for message content type
CREATE TYPE public.message_content_type AS ENUM ('text', 'image', 'audio', 'video', 'document', 'sticker', 'location');

-- Create ENUM for message status
CREATE TYPE public.message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- Create ENUM for instance status
CREATE TYPE public.instance_status AS ENUM ('disconnected', 'connecting', 'connected', 'qr_code');

-- Create ENUM for conversation status
CREATE TYPE public.conversation_status AS ENUM ('active', 'archived', 'closed');

-- ============================================
-- Table: instances (WhatsApp connections)
-- ============================================
CREATE TABLE public.instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider public.whatsapp_provider NOT NULL DEFAULT 'evolution_api',
  api_url TEXT,
  api_key_encrypted TEXT,
  phone_number TEXT,
  status public.instance_status NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  webhook_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization instances"
  ON public.instances FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their organization instances"
  ON public.instances FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can update their organization instances"
  ON public.instances FOR UPDATE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their organization instances"
  ON public.instances FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE TRIGGER update_instances_updated_at
  BEFORE UPDATE ON public.instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Table: pipelines (Dynamic Kanban boards)
-- ============================================
CREATE TABLE public.pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization pipelines"
  ON public.pipelines FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their organization pipelines"
  ON public.pipelines FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can update their organization pipelines"
  ON public.pipelines FOR UPDATE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their organization pipelines"
  ON public.pipelines FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Table: stages (Kanban columns)
-- ============================================
CREATE TABLE public.stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stages of their pipelines"
  ON public.stages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.pipelines p 
    WHERE p.id = stages.pipeline_id 
    AND p.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can insert stages in their pipelines"
  ON public.stages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pipelines p 
    WHERE p.id = stages.pipeline_id 
    AND p.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can update stages in their pipelines"
  ON public.stages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.pipelines p 
    WHERE p.id = stages.pipeline_id 
    AND p.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can delete stages in their pipelines"
  ON public.stages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.pipelines p 
    WHERE p.id = stages.pipeline_id 
    AND p.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE TRIGGER update_stages_updated_at
  BEFORE UPDATE ON public.stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Table: contacts (Leads/Contacts)
-- ============================================
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.instances(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  pipeline_stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  last_interaction_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization contacts"
  ON public.contacts FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their organization contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can update their organization contacts"
  ON public.contacts FOR UPDATE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their organization contacts"
  ON public.contacts FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for phone lookups
CREATE INDEX idx_contacts_phone ON public.contacts(phone);
CREATE INDEX idx_contacts_organization ON public.contacts(organization_id);

-- ============================================
-- Table: conversations (Chat threads)
-- ============================================
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.instances(id) ON DELETE SET NULL,
  status public.conversation_status NOT NULL DEFAULT 'active',
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conversations of their contacts"
  ON public.conversations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = conversations.contact_id 
    AND c.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can insert conversations for their contacts"
  ON public.conversations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = conversations.contact_id 
    AND c.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can update conversations of their contacts"
  ON public.conversations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = conversations.contact_id 
    AND c.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can delete conversations of their contacts"
  ON public.conversations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = conversations.contact_id 
    AND c.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- ============================================
-- Table: messages (Individual messages)
-- ============================================
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id_external TEXT,
  direction public.message_direction NOT NULL,
  content_type public.message_content_type NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  status public.message_status NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages of their conversations"
  ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversations conv
    JOIN public.contacts c ON c.id = conv.contact_id
    WHERE conv.id = messages.conversation_id 
    AND c.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can insert messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations conv
    JOIN public.contacts c ON c.id = conv.contact_id
    WHERE conv.id = messages.conversation_id 
    AND c.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can update messages in their conversations"
  ON public.messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.conversations conv
    JOIN public.contacts c ON c.id = conv.contact_id
    WHERE conv.id = messages.conversation_id 
    AND c.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE POLICY "Users can delete messages in their conversations"
  ON public.messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.conversations conv
    JOIN public.contacts c ON c.id = conv.contact_id
    WHERE conv.id = messages.conversation_id 
    AND c.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
  ));

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON public.messages(timestamp DESC);
CREATE INDEX idx_messages_external_id ON public.messages(message_id_external);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;