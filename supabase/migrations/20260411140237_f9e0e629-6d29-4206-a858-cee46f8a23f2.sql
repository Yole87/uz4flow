
-- Add position columns to flow_steps
ALTER TABLE public.flow_steps
ADD COLUMN IF NOT EXISTS position_x FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS position_y FLOAT DEFAULT 0;

-- Populate default positions for existing steps (vertical layout)
UPDATE public.flow_steps
SET position_x = 250, position_y = order_index * 180;

-- Create flow_connections table
CREATE TABLE public.flow_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  source_step_id UUID NOT NULL REFERENCES public.flow_steps(id) ON DELETE CASCADE,
  target_step_id UUID NOT NULL REFERENCES public.flow_steps(id) ON DELETE CASCADE,
  source_handle TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flow_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies: same as flow_steps (flow owner)
CREATE POLICY "Users can view their flow connections"
ON public.flow_connections FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.flows f
    WHERE f.id = flow_id AND f.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their flow connections"
ON public.flow_connections FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.flows f
    WHERE f.id = flow_id AND f.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their flow connections"
ON public.flow_connections FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.flows f
    WHERE f.id = flow_id AND f.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their flow connections"
ON public.flow_connections FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.flows f
    WHERE f.id = flow_id AND f.user_id = auth.uid()
  )
);

-- Admin master access
CREATE POLICY "Admin master can manage all flow connections"
ON public.flow_connections FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

-- Generate default connections between consecutive steps for existing flows
INSERT INTO public.flow_connections (flow_id, source_step_id, target_step_id)
SELECT 
  s1.flow_id,
  s1.id AS source_step_id,
  s2.id AS target_step_id
FROM public.flow_steps s1
JOIN public.flow_steps s2 
  ON s1.flow_id = s2.flow_id 
  AND s2.order_index = s1.order_index + 1
ORDER BY s1.flow_id, s1.order_index;
