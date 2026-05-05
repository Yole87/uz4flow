
-- =============================================
-- FLOW_STEPS: Drop and recreate all 4 policies
-- =============================================
DROP POLICY IF EXISTS "Users can view their own flow steps" ON public.flow_steps;
DROP POLICY IF EXISTS "Users can insert their own flow steps" ON public.flow_steps;
DROP POLICY IF EXISTS "Users can update their own flow steps" ON public.flow_steps;
DROP POLICY IF EXISTS "Users can delete their own flow steps" ON public.flow_steps;

CREATE POLICY "Users can view their own flow steps" ON public.flow_steps
FOR SELECT USING (
  EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin_master')
);

CREATE POLICY "Users can insert their own flow steps" ON public.flow_steps
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin_master')
);

CREATE POLICY "Users can update their own flow steps" ON public.flow_steps
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin_master')
);

CREATE POLICY "Users can delete their own flow steps" ON public.flow_steps
FOR DELETE USING (
  EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin_master')
);

-- =============================================
-- FILES: Drop and recreate all 3 policies
-- =============================================
DROP POLICY IF EXISTS "Users can view their own files" ON public.files;
DROP POLICY IF EXISTS "Users can insert their own files" ON public.files;
DROP POLICY IF EXISTS "Users can delete their own files" ON public.files;

CREATE POLICY "Users can view their own files" ON public.files
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can insert their own files" ON public.files
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can delete their own files" ON public.files
FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

-- =============================================
-- EVENTS: Drop and recreate all 3 policies
-- =============================================
DROP POLICY IF EXISTS "Users can view their own events" ON public.events;
DROP POLICY IF EXISTS "Users can insert their own events" ON public.events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.events;

CREATE POLICY "Users can view their own events" ON public.events
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can insert their own events" ON public.events
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can update their own events" ON public.events
FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

-- =============================================
-- CONNECTOR_EVENTS: Drop and recreate all 3 policies
-- =============================================
DROP POLICY IF EXISTS "Users can view their own connector events" ON public.connector_events;
DROP POLICY IF EXISTS "Users can insert their own connector events" ON public.connector_events;
DROP POLICY IF EXISTS "Users can update their own connector events" ON public.connector_events;

CREATE POLICY "Users can view their own connector events" ON public.connector_events
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can insert their own connector events" ON public.connector_events
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can update their own connector events" ON public.connector_events
FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

-- =============================================
-- AUTO_REENGAGEMENT_CONFIG: Drop and recreate all 4 policies
-- =============================================
DROP POLICY IF EXISTS "Users can view their own configs" ON public.auto_reengagement_config;
DROP POLICY IF EXISTS "Users can insert their own configs" ON public.auto_reengagement_config;
DROP POLICY IF EXISTS "Users can update their own configs" ON public.auto_reengagement_config;
DROP POLICY IF EXISTS "Users can delete their own configs" ON public.auto_reengagement_config;

CREATE POLICY "Users can view their own configs" ON public.auto_reengagement_config
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can insert their own configs" ON public.auto_reengagement_config
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can update their own configs" ON public.auto_reengagement_config
FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can delete their own configs" ON public.auto_reengagement_config
FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));
