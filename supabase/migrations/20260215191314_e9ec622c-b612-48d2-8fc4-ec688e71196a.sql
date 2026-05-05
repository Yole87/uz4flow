
-- 1. Fix: allow manual contacts without contact_id
ALTER TABLE public.voice_campaign_contacts
  ALTER COLUMN contact_id DROP NOT NULL;

-- 2. New columns on voice_campaigns
ALTER TABLE public.voice_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_followup_file_name text,
  ADD COLUMN IF NOT EXISTS whatsapp_followup_file_size bigint,
  ADD COLUMN IF NOT EXISTS flow_id uuid REFERENCES public.flows(id),
  ADD COLUMN IF NOT EXISTS template_id uuid;

-- 3. New table: followup_templates
CREATE TABLE public.followup_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  script_content text,
  call_reason text,
  whatsapp_followup_enabled boolean NOT NULL DEFAULT false,
  whatsapp_followup_text text,
  webhook_enabled boolean NOT NULL DEFAULT false,
  flow_id uuid REFERENCES public.flows(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org templates"
  ON public.followup_templates FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can insert org templates"
  ON public.followup_templates FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update org templates"
  ON public.followup_templates FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can delete org templates"
  ON public.followup_templates FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE TRIGGER update_followup_templates_updated_at
  BEFORE UPDATE ON public.followup_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
