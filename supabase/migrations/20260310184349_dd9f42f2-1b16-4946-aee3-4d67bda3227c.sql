
-- =============================================
-- FLOWS: Drop and recreate all 4 policies
-- =============================================
DROP POLICY IF EXISTS "Users can view their own flows" ON public.flows;
DROP POLICY IF EXISTS "Users can insert their own flows" ON public.flows;
DROP POLICY IF EXISTS "Users can update their own flows" ON public.flows;
DROP POLICY IF EXISTS "Users can delete their own flows" ON public.flows;

CREATE POLICY "Users can view their own flows" ON public.flows
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can insert their own flows" ON public.flows
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can update their own flows" ON public.flows
FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can delete their own flows" ON public.flows
FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

-- =============================================
-- WEBHOOK_CONNECTORS: Drop and recreate all 4 policies
-- =============================================
DROP POLICY IF EXISTS "Users can view their own connectors" ON public.webhook_connectors;
DROP POLICY IF EXISTS "Users can insert their own connectors" ON public.webhook_connectors;
DROP POLICY IF EXISTS "Users can update their own connectors" ON public.webhook_connectors;
DROP POLICY IF EXISTS "Users can delete their own connectors" ON public.webhook_connectors;

CREATE POLICY "Users can view their own connectors" ON public.webhook_connectors
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can insert their own connectors" ON public.webhook_connectors
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can update their own connectors" ON public.webhook_connectors
FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can delete their own connectors" ON public.webhook_connectors
FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

-- =============================================
-- ROUTING_RULES: Drop and recreate all 4 policies
-- =============================================
DROP POLICY IF EXISTS "Users can view their own routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Users can insert their own routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Users can update their own routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Users can delete their own routing rules" ON public.routing_rules;

CREATE POLICY "Users can view their own routing rules" ON public.routing_rules
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can insert their own routing rules" ON public.routing_rules
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can update their own routing rules" ON public.routing_rules
FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Users can delete their own routing rules" ON public.routing_rules
FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));
