-- Inserir role admin_master para o super admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('21e61976-3fbf-45ab-810e-346b10de7ed0', 'admin_master')
ON CONFLICT DO NOTHING;

-- Criar organização administrativa
INSERT INTO public.organizations (id, name, slug, owner_user_id, is_active)
VALUES (
  gen_random_uuid(),
  'Administração',
  'admin',
  '21e61976-3fbf-45ab-810e-346b10de7ed0',
  true
)
ON CONFLICT DO NOTHING;

-- Adicionar admin como membro da organização
INSERT INTO public.organization_members (user_id, organization_id, role)
SELECT 
  '21e61976-3fbf-45ab-810e-346b10de7ed0',
  id,
  'owner'
FROM public.organizations 
WHERE slug = 'admin'
ON CONFLICT DO NOTHING;

-- Criar assinatura administrativa permanente (usando o plano mais completo)
INSERT INTO public.subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
SELECT 
  o.id,
  (SELECT id FROM subscription_plans WHERE is_active = true ORDER BY price DESC LIMIT 1),
  'active',
  NOW(),
  NOW() + INTERVAL '100 years'
FROM public.organizations o
WHERE o.slug = 'admin'
ON CONFLICT DO NOTHING;