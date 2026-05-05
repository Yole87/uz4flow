
-- Create quick_replies table
CREATE TABLE public.quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org quick replies" ON public.quick_replies
  FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can insert org quick replies" ON public.quick_replies
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can update org quick replies" ON public.quick_replies
  FOR UPDATE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can delete org quick replies" ON public.quick_replies
  FOR DELETE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- Index for fast lookups
CREATE INDEX idx_quick_replies_org ON public.quick_replies(organization_id);
