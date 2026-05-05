
CREATE TABLE public.meta_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  template_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.meta_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_crud" ON public.meta_templates
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.instances i
    JOIN public.organization_members om ON om.organization_id = i.organization_id
    WHERE i.id = meta_templates.instance_id AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.instances i
    JOIN public.organization_members om ON om.organization_id = i.organization_id
    WHERE i.id = meta_templates.instance_id AND om.user_id = auth.uid()
  )
);
