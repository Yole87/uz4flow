
-- 1. team_member_instances: mapeia membros a instâncias
CREATE TABLE public.team_member_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_member_id, instance_id)
);

ALTER TABLE public.team_member_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view team_member_instances of their org"
  ON public.team_member_instances FOR SELECT TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members 
      WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  );

CREATE POLICY "Members can manage team_member_instances of their org"
  ON public.team_member_instances FOR ALL TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members 
      WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  )
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM public.team_members 
      WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  );

-- 2. instagram_account_instances: mapeia contas IG a instâncias WhatsApp
CREATE TABLE public.instagram_account_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, instance_id)
);

ALTER TABLE public.instagram_account_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view instagram_account_instances of their org"
  ON public.instagram_account_instances FOR SELECT TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.instagram_accounts 
      WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  );

CREATE POLICY "Members can manage instagram_account_instances of their org"
  ON public.instagram_account_instances FOR ALL TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.instagram_accounts 
      WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.instagram_accounts 
      WHERE organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  );

-- 3. Adicionar instance_id em pipeline_keyword_rules
ALTER TABLE public.pipeline_keyword_rules 
  ADD COLUMN instance_id uuid REFERENCES public.instances(id) ON DELETE SET NULL;

-- 4. Adicionar instance_id em voice_campaigns
ALTER TABLE public.voice_campaigns 
  ADD COLUMN instance_id uuid REFERENCES public.instances(id) ON DELETE SET NULL;

-- 5. Adicionar instance_id em prospect_searches (para importação de contatos)
ALTER TABLE public.prospect_searches 
  ADD COLUMN instance_id uuid REFERENCES public.instances(id) ON DELETE SET NULL;

-- 6. Adicionar instance_id em followup_templates (campanhas follow-up)
ALTER TABLE public.followup_templates 
  ADD COLUMN instance_id uuid REFERENCES public.instances(id) ON DELETE SET NULL;
