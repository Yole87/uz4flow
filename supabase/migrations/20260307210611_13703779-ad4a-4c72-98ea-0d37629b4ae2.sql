
-- Table: billing_message_templates
CREATE TABLE public.billing_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE,
  label text NOT NULL,
  message_template text NOT NULL,
  is_active boolean DEFAULT true,
  send_via_whatsapp boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.billing_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read billing templates"
  ON public.billing_message_templates FOR SELECT
  TO authenticated
  USING (public.is_admin_master());

CREATE POLICY "Admin can insert billing templates"
  ON public.billing_message_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_master());

CREATE POLICY "Admin can update billing templates"
  ON public.billing_message_templates FOR UPDATE
  TO authenticated
  USING (public.is_admin_master());

CREATE POLICY "Admin can delete billing templates"
  ON public.billing_message_templates FOR DELETE
  TO authenticated
  USING (public.is_admin_master());

-- Service role needs access for edge functions
CREATE POLICY "Service role full access billing templates"
  ON public.billing_message_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Table: billing_notifications_log
CREATE TABLE public.billing_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  event_type text NOT NULL,
  phone text NOT NULL,
  message_sent text NOT NULL,
  status text DEFAULT 'sent',
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.billing_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read billing logs"
  ON public.billing_notifications_log FOR SELECT
  TO authenticated
  USING (public.is_admin_master());

CREATE POLICY "Service role full access billing logs"
  ON public.billing_notifications_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed default templates
INSERT INTO public.billing_message_templates (event_type, label, message_template) VALUES
('payment_approved', 'Pagamento Aprovado', 'Olá {{nome}}! ✅ Seu pagamento de R$ {{valor}} referente ao plano *{{plano}}* foi aprovado com sucesso. Obrigado pela confiança!'),
('payment_pending', 'Pagamento Pendente (Pix/Boleto)', 'Olá {{nome}}! 💳 Seu pagamento de R$ {{valor}} do plano *{{plano}}* está pendente. Realize o pagamento até {{vencimento}} para evitar a suspensão do serviço. Link: {{link_pagamento}}'),
('payment_rejected', 'Cartão Recusado', 'Olá {{nome}}! ⚠️ O pagamento de R$ {{valor}} do seu plano *{{plano}}* foi recusado. Motivo: {{motivo}}. Atualize seus dados de pagamento para manter o acesso: {{link_pagamento}}'),
('subscription_paused', 'Assinatura Suspensa', 'Olá {{nome}}! ⏸️ Sua assinatura do plano *{{plano}}* foi suspensa por falta de pagamento. Regularize para reativar o acesso: {{link_pagamento}}'),
('subscription_cancelled', 'Assinatura Cancelada', 'Olá {{nome}}! ❌ Sua assinatura do plano *{{plano}}* foi cancelada. Caso deseje retomar, acesse: {{link_pagamento}}'),
('payment_refunded', 'Reembolso Confirmado', 'Olá {{nome}}! 💰 Seu reembolso de R$ {{valor}} referente ao plano *{{plano}}* foi processado com sucesso. O valor será devolvido em até 10 dias úteis.'),
('renewal_reminder', 'Lembrete de Renovação (D-3)', 'Olá {{nome}}! 🔔 Sua assinatura do plano *{{plano}}* será renovada em {{vencimento}}. O valor de R$ {{valor}} será cobrado automaticamente. Certifique-se de que seus dados de pagamento estão atualizados.'),
('payment_overdue', 'Cobrança em Atraso (D+3)', 'Olá {{nome}}! 🚨 Sua assinatura do plano *{{plano}}* está com pagamento em atraso desde {{vencimento}}. Regularize para evitar a suspensão do serviço: {{link_pagamento}}');
