-- Garantir uma única instância CRM por (organização, conta Instagram)
CREATE UNIQUE INDEX IF NOT EXISTS instances_org_ig_account_unique
  ON public.instances (organization_id, instagram_account_id)
  WHERE channel = 'instagram' AND instagram_account_id IS NOT NULL;