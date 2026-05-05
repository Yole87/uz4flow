-- Add column to mark if a quick reply applies to all instances (default true for backward compatibility)
ALTER TABLE public.quick_replies
ADD COLUMN IF NOT EXISTS applies_to_all_instances boolean NOT NULL DEFAULT true;

-- Junction table linking quick_replies to instances
CREATE TABLE IF NOT EXISTS public.quick_reply_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_reply_id uuid NOT NULL REFERENCES public.quick_replies(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (quick_reply_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_quick_reply_instances_qr ON public.quick_reply_instances(quick_reply_id);
CREATE INDEX IF NOT EXISTS idx_quick_reply_instances_inst ON public.quick_reply_instances(instance_id);

-- Enable RLS
ALTER TABLE public.quick_reply_instances ENABLE ROW LEVEL SECURITY;

-- RLS: members of the org owning the quick_reply can manage links
CREATE POLICY "Members can view quick reply instance links"
ON public.quick_reply_instances
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.quick_replies qr
    WHERE qr.id = quick_reply_instances.quick_reply_id
      AND qr.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Members can insert quick reply instance links"
ON public.quick_reply_instances
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quick_replies qr
    WHERE qr.id = quick_reply_instances.quick_reply_id
      AND qr.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Members can update quick reply instance links"
ON public.quick_reply_instances
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.quick_replies qr
    WHERE qr.id = quick_reply_instances.quick_reply_id
      AND qr.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);

CREATE POLICY "Members can delete quick reply instance links"
ON public.quick_reply_instances
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.quick_replies qr
    WHERE qr.id = quick_reply_instances.quick_reply_id
      AND qr.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  )
);