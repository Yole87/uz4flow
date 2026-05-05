-- Plan change log table for auditing
CREATE TABLE public.plan_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  to_plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  from_billing_cycle TEXT,
  to_billing_cycle TEXT,
  changed_by_user_id UUID,
  change_source TEXT NOT NULL DEFAULT 'user', -- user, admin, system, webhook
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_change_log_org ON public.plan_change_log(organization_id, created_at DESC);

ALTER TABLE public.plan_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org plan change log"
ON public.plan_change_log
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  OR public.is_admin_master()
);

-- No INSERT policy: only service role can write (via edge functions / triggers)