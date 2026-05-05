-- =====================================================
-- FASE 1: ESTRUTURA DE DADOS PARA SAAS
-- =====================================================

-- 1. Enum para roles do sistema
CREATE TYPE public.app_role AS ENUM ('admin_master', 'admin', 'user');

-- 2. Tabela de organizações/tenants
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    blocked_at TIMESTAMPTZ,
    block_reason TEXT,
    owner_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Membros das organizações
CREATE TABLE public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- 4. Roles de usuário (para admin master)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, role)
);

-- 5. Planos de assinatura
CREATE TABLE public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    billing_cycle TEXT DEFAULT 'monthly',
    
    -- Limites do plano (JSONB para flexibilidade)
    limits JSONB DEFAULT '{
        "max_flows": 5,
        "max_connectors": 3,
        "max_rules": 10,
        "max_templates": 20,
        "max_events_per_month": 1000,
        "max_file_storage_mb": 100,
        "features": ["basic_analytics"]
    }'::jsonb,
    
    -- Integração Mercado Pago
    mp_plan_id TEXT,
    
    is_public BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    is_free BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    
    -- Visual na landing page
    highlight_label TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Assinaturas ativas
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
    
    status TEXT DEFAULT 'pending',
    
    -- Datas do ciclo
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Integração Mercado Pago
    mp_subscription_id TEXT,
    mp_payer_id TEXT,
    
    -- Alertas
    payment_warning_sent BOOLEAN DEFAULT false,
    expiration_warning_sent BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(organization_id)
);

-- 7. Histórico de pagamentos
CREATE TABLE public.subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    
    -- Mercado Pago
    mp_payment_id TEXT,
    mp_payment_type TEXT,
    mp_payment_method TEXT,
    
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Log de uso para controle de limites
CREATE TABLE public.usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    resource_type TEXT NOT NULL,
    action TEXT NOT NULL,
    quantity INT DEFAULT 1,
    
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Resumo mensal de uso
CREATE TABLE public.usage_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    flows_count INT DEFAULT 0,
    connectors_count INT DEFAULT 0,
    rules_count INT DEFAULT 0,
    templates_count INT DEFAULT 0,
    events_count INT DEFAULT 0,
    storage_used_mb DECIMAL(10,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(organization_id, period_start)
);

-- 10. Configurações do SaaS/Landing Page
CREATE TABLE public.saas_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para verificar se usuário é admin master
CREATE OR REPLACE FUNCTION public.is_admin_master()
RETURNS BOOLEAN 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin_master')
$$;

-- Função para obter organização do usuário
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Função para verificar se organização está ativa
CREATE OR REPLACE FUNCTION public.is_organization_active(_org_id UUID)
RETURNS BOOLEAN 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.subscriptions s ON s.organization_id = o.id
    WHERE o.id = _org_id 
    AND o.is_active = true 
    AND o.blocked_at IS NULL
    AND s.status = 'active'
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  )
$$;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin master can do everything on organizations"
ON public.organizations FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

CREATE POLICY "Users can view their own organization"
ON public.organizations FOR SELECT
USING (
  id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

CREATE POLICY "Owner can update their organization"
ON public.organizations FOR UPDATE
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- Organization Members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin master can do everything on members"
ON public.organization_members FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

CREATE POLICY "Members can view their organization members"
ON public.organization_members FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

CREATE POLICY "Organization owner can manage members"
ON public.organization_members FOR ALL
USING (
  organization_id IN (SELECT id FROM public.organizations WHERE owner_user_id = auth.uid())
)
WITH CHECK (
  organization_id IN (SELECT id FROM public.organizations WHERE owner_user_id = auth.uid())
);

-- User Roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin master can manage roles"
ON public.user_roles FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Subscription Plans
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public active plans"
ON public.subscription_plans FOR SELECT
USING (is_public = true AND is_active = true);

CREATE POLICY "Admin master can manage all plans"
ON public.subscription_plans FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

-- Subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin master can do everything on subscriptions"
ON public.subscriptions FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

CREATE POLICY "Users can view their organization subscription"
ON public.subscriptions FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

-- Subscription Payments
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin master can do everything on payments"
ON public.subscription_payments FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

CREATE POLICY "Users can view their organization payments"
ON public.subscription_payments FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

-- Usage Logs
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin master can do everything on usage logs"
ON public.usage_logs FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

CREATE POLICY "Users can view their organization usage"
ON public.usage_logs FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

CREATE POLICY "System can insert usage logs"
ON public.usage_logs FOR INSERT
WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

-- Usage Summary
ALTER TABLE public.usage_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin master can do everything on usage summary"
ON public.usage_summary FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

CREATE POLICY "Users can view their organization summary"
ON public.usage_summary FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

-- SaaS Settings
ALTER TABLE public.saas_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view saas settings"
ON public.saas_settings FOR SELECT
USING (true);

CREATE POLICY "Admin master can manage settings"
ON public.saas_settings FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para updated_at nas tabelas que precisam
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usage_summary_updated_at
BEFORE UPDATE ON public.usage_summary
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saas_settings_updated_at
BEFORE UPDATE ON public.saas_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Inserir planos iniciais
INSERT INTO public.subscription_plans (name, description, price, billing_cycle, limits, is_free, sort_order, highlight_label) VALUES
(
  'Gratuito',
  'Ideal para testar a plataforma',
  0,
  'monthly',
  '{"max_flows": 2, "max_connectors": 1, "max_rules": 3, "max_templates": 5, "max_events_per_month": 100, "max_file_storage_mb": 10, "features": []}'::jsonb,
  true,
  1,
  NULL
),
(
  'Starter',
  'Para pequenos negócios começando a automatizar',
  49.90,
  'monthly',
  '{"max_flows": 5, "max_connectors": 3, "max_rules": 10, "max_templates": 20, "max_events_per_month": 1000, "max_file_storage_mb": 100, "features": ["basic_analytics"]}'::jsonb,
  false,
  2,
  NULL
),
(
  'Profissional',
  'Para negócios em crescimento com alto volume',
  99.90,
  'monthly',
  '{"max_flows": 20, "max_connectors": 10, "max_rules": 50, "max_templates": 100, "max_events_per_month": 10000, "max_file_storage_mb": 500, "features": ["basic_analytics", "advanced_analytics", "priority_support"]}'::jsonb,
  false,
  3,
  'Mais Popular'
),
(
  'Enterprise',
  'Para grandes operações com necessidades customizadas',
  299.90,
  'monthly',
  '{"max_flows": -1, "max_connectors": -1, "max_rules": -1, "max_templates": -1, "max_events_per_month": -1, "max_file_storage_mb": -1, "features": ["basic_analytics", "advanced_analytics", "priority_support", "api_access", "whitelabel", "dedicated_support"]}'::jsonb,
  false,
  4,
  NULL
);

-- Inserir configurações iniciais do SaaS
INSERT INTO public.saas_settings (key, value) VALUES
('landing_page', '{
  "hero": {
    "title": "Automatize seu WhatsApp Business",
    "subtitle": "Crie fluxos inteligentes, conecte sistemas e escale seu atendimento com nossa plataforma completa de automação.",
    "cta_text": "Começar Gratuitamente",
    "cta_secondary_text": "Ver Demonstração"
  },
  "features": [
    {"icon": "Zap", "title": "Fluxos Automatizados", "description": "Crie sequências de mensagens personalizadas para cada tipo de cliente."},
    {"icon": "Plug", "title": "Conectores Universais", "description": "Integre com qualquer sistema via webhooks e APIs."},
    {"icon": "Route", "title": "Regras Inteligentes", "description": "Direcione mensagens automaticamente baseado em palavras-chave."},
    {"icon": "BarChart", "title": "Analytics Completo", "description": "Acompanhe métricas e performance em tempo real."}
  ],
  "faq": [
    {"question": "Como funciona o período de teste?", "answer": "Você pode usar o plano gratuito sem limite de tempo com funcionalidades básicas."},
    {"question": "Posso mudar de plano a qualquer momento?", "answer": "Sim! Você pode fazer upgrade ou downgrade quando quiser."},
    {"question": "Como funciona o suporte?", "answer": "Todos os planos incluem suporte por email. Planos Pro e Enterprise incluem suporte prioritário."}
  ]
}'::jsonb),
('general', '{
  "app_name": "FlowBot",
  "support_email": "suporte@flowbot.com.br",
  "terms_url": "/termos",
  "privacy_url": "/privacidade"
}'::jsonb);