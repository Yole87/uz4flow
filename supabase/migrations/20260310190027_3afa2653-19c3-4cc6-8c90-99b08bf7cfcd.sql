
-- ============================================================
-- ETAPA 1: Automações (sub-tabelas user_id)
-- ============================================================

-- auto_reengagement_queue (4 policies)
DROP POLICY IF EXISTS "Users can view their own queue items" ON public.auto_reengagement_queue;
DROP POLICY IF EXISTS "Users can insert their own queue items" ON public.auto_reengagement_queue;
DROP POLICY IF EXISTS "Users can update their own queue items" ON public.auto_reengagement_queue;
DROP POLICY IF EXISTS "Users can delete their own queue items" ON public.auto_reengagement_queue;

CREATE POLICY "Users can view their own queue items" ON public.auto_reengagement_queue
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can insert their own queue items" ON public.auto_reengagement_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can update their own queue items" ON public.auto_reengagement_queue
  FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can delete their own queue items" ON public.auto_reengagement_queue
  FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

-- integrations (4 policies)
DROP POLICY IF EXISTS "Users can view their own integration basic info" ON public.integrations;
DROP POLICY IF EXISTS "Users can insert their own integration" ON public.integrations;
DROP POLICY IF EXISTS "Users can update their own integration" ON public.integrations;
DROP POLICY IF EXISTS "Users can delete their own integration" ON public.integrations;

CREATE POLICY "Users can view their own integration basic info" ON public.integrations
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can insert their own integration" ON public.integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can update their own integration" ON public.integrations
  FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can delete their own integration" ON public.integrations
  FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

-- message_templates (4 policies)
DROP POLICY IF EXISTS "Users can view their own templates and defaults" ON public.message_templates;
DROP POLICY IF EXISTS "Users can insert their own templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON public.message_templates;

CREATE POLICY "Users can view their own templates and defaults" ON public.message_templates
  FOR SELECT USING ((auth.uid() = user_id OR is_default = true) OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can insert their own templates" ON public.message_templates
  FOR INSERT WITH CHECK ((auth.uid() = user_id AND is_default = false) OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can update their own templates" ON public.message_templates
  FOR UPDATE USING ((auth.uid() = user_id AND is_default = false) OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can delete their own templates" ON public.message_templates
  FOR DELETE USING ((auth.uid() = user_id AND is_default = false) OR public.has_role(auth.uid(), 'admin_master'));

-- flow_sessions (4 policies)
DROP POLICY IF EXISTS "Users can view their own flow sessions" ON public.flow_sessions;
DROP POLICY IF EXISTS "Users can insert their own flow sessions" ON public.flow_sessions;
DROP POLICY IF EXISTS "Users can update their own flow sessions" ON public.flow_sessions;
DROP POLICY IF EXISTS "Users can delete their own flow sessions" ON public.flow_sessions;

CREATE POLICY "Users can view their own flow sessions" ON public.flow_sessions
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can insert their own flow sessions" ON public.flow_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can update their own flow sessions" ON public.flow_sessions
  FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Users can delete their own flow sessions" ON public.flow_sessions
  FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_master'));

-- session_responses (4 policies - JOIN via flow_sessions)
DROP POLICY IF EXISTS "Users can view their own session responses" ON public.session_responses;
DROP POLICY IF EXISTS "Users can insert their own session responses" ON public.session_responses;
DROP POLICY IF EXISTS "Users can update their own session responses" ON public.session_responses;
DROP POLICY IF EXISTS "Users can delete their own session responses" ON public.session_responses;

CREATE POLICY "Users can view their own session responses" ON public.session_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM flow_sessions WHERE flow_sessions.id = session_responses.session_id AND flow_sessions.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_master')
  );
CREATE POLICY "Users can insert their own session responses" ON public.session_responses
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM flow_sessions WHERE flow_sessions.id = session_responses.session_id AND flow_sessions.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_master')
  );
CREATE POLICY "Users can update their own session responses" ON public.session_responses
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM flow_sessions WHERE flow_sessions.id = session_responses.session_id AND flow_sessions.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_master')
  );
CREATE POLICY "Users can delete their own session responses" ON public.session_responses
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM flow_sessions WHERE flow_sessions.id = session_responses.session_id AND flow_sessions.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_master')
  );

-- event_actions (3 policies - JOIN via events)
DROP POLICY IF EXISTS "Users can view their own event actions" ON public.event_actions;
DROP POLICY IF EXISTS "Users can insert their own event actions" ON public.event_actions;
DROP POLICY IF EXISTS "Users can update their own event actions" ON public.event_actions;

CREATE POLICY "Users can view their own event actions" ON public.event_actions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_actions.event_id AND events.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_master')
  );
CREATE POLICY "Users can insert their own event actions" ON public.event_actions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_actions.event_id AND events.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_master')
  );
CREATE POLICY "Users can update their own event actions" ON public.event_actions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_actions.event_id AND events.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_master')
  );

-- ============================================================
-- ETAPA 2: Follow-Up (trocar JOIN direto por get_user_organization_ids)
-- ============================================================

DROP POLICY IF EXISTS "Members can view org templates" ON public.followup_templates;
DROP POLICY IF EXISTS "Members can insert org templates" ON public.followup_templates;
DROP POLICY IF EXISTS "Members can update org templates" ON public.followup_templates;
DROP POLICY IF EXISTS "Members can delete org templates" ON public.followup_templates;

CREATE POLICY "Members can view org templates" ON public.followup_templates
  FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert org templates" ON public.followup_templates
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update org templates" ON public.followup_templates
  FOR UPDATE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete org templates" ON public.followup_templates
  FOR DELETE USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- ============================================================
-- ETAPA 3: Assinatura e Uso (subscriptions, usage_logs, usage_summary already have admin_master ALL)
-- Only fix the non-admin SELECT/INSERT that use direct JOINs
-- ============================================================

-- subscriptions: SELECT for members (already has admin_master ALL policy)
DROP POLICY IF EXISTS "Users can view their organization subscription" ON public.subscriptions;
CREATE POLICY "Users can view their organization subscription" ON public.subscriptions
  FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- usage_logs: SELECT and INSERT for members (already has admin_master ALL policy)
DROP POLICY IF EXISTS "Users can view their organization usage" ON public.usage_logs;
DROP POLICY IF EXISTS "System can insert usage logs" ON public.usage_logs;

CREATE POLICY "Users can view their organization usage" ON public.usage_logs
  FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "System can insert usage logs" ON public.usage_logs
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- usage_summary: SELECT for members (already has admin_master ALL policy)
DROP POLICY IF EXISTS "Users can view their organization summary" ON public.usage_summary;
CREATE POLICY "Users can view their organization summary" ON public.usage_summary
  FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- ============================================================
-- ETAPA 4: CRM Settings (owner-restricted writes → add admin_master bypass)
-- ============================================================

-- crm_openbot_config (INSERT, UPDATE, DELETE - keep SELECT as false for security view)
DROP POLICY IF EXISTS "Owners can insert their org config" ON public.crm_openbot_config;
DROP POLICY IF EXISTS "Owners can update their org config" ON public.crm_openbot_config;
DROP POLICY IF EXISTS "Owners can delete their org config" ON public.crm_openbot_config;

CREATE POLICY "Owners can insert their org config" ON public.crm_openbot_config
  FOR INSERT WITH CHECK (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Owners can update their org config" ON public.crm_openbot_config
  FOR UPDATE USING (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Owners can delete their org config" ON public.crm_openbot_config
  FOR DELETE USING (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));

-- prospect_providers (INSERT, UPDATE, DELETE - keep SELECT as false for security view)
DROP POLICY IF EXISTS "Owners can insert prospect providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Owners can update their prospect providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Owners can delete their prospect providers" ON public.prospect_providers;

CREATE POLICY "Owners can insert prospect providers" ON public.prospect_providers
  FOR INSERT WITH CHECK (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Owners can update their prospect providers" ON public.prospect_providers
  FOR UPDATE USING (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Owners can delete their prospect providers" ON public.prospect_providers
  FOR DELETE USING (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));

-- pipeline_keyword_rules (INSERT, UPDATE, DELETE - SELECT already uses get_user_organization_ids)
DROP POLICY IF EXISTS "Owners can insert org keyword rules" ON public.pipeline_keyword_rules;
DROP POLICY IF EXISTS "Owners can update org keyword rules" ON public.pipeline_keyword_rules;
DROP POLICY IF EXISTS "Owners can delete org keyword rules" ON public.pipeline_keyword_rules;

CREATE POLICY "Owners can insert org keyword rules" ON public.pipeline_keyword_rules
  FOR INSERT WITH CHECK (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Owners can update org keyword rules" ON public.pipeline_keyword_rules
  FOR UPDATE USING (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Owners can delete org keyword rules" ON public.pipeline_keyword_rules
  FOR DELETE USING (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));

-- team_members (ALL manage policy - SELECT already uses get_user_organization_ids)
DROP POLICY IF EXISTS "Org owners can manage team members" ON public.team_members;
CREATE POLICY "Org owners can manage team members" ON public.team_members
  FOR ALL TO authenticated
  USING (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'))
  WITH CHECK (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));

-- team_profiles (INSERT, UPDATE, DELETE - SELECT already uses get_user_organization_ids)
DROP POLICY IF EXISTS "Org owners can manage team profiles" ON public.team_profiles;
DROP POLICY IF EXISTS "Org owners can update team profiles" ON public.team_profiles;
DROP POLICY IF EXISTS "Org owners can delete team profiles" ON public.team_profiles;

CREATE POLICY "Org owners can manage team profiles" ON public.team_profiles
  FOR INSERT TO authenticated WITH CHECK (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Org owners can update team profiles" ON public.team_profiles
  FOR UPDATE TO authenticated USING (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Org owners can delete team profiles" ON public.team_profiles
  FOR DELETE TO authenticated USING (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));

-- lead_rotation_config (ALL manage policy - SELECT already uses get_user_organization_ids)
DROP POLICY IF EXISTS "Org owners can manage rotation config" ON public.lead_rotation_config;
CREATE POLICY "Org owners can manage rotation config" ON public.lead_rotation_config
  FOR ALL TO authenticated
  USING (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'))
  WITH CHECK (is_organization_owner(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));

-- ============================================================
-- ETAPA 5: Meta/CRM (JOINs diretos via organization_members)
-- ============================================================

-- meta_templates (ALL policy with JOIN)
DROP POLICY IF EXISTS "org_members_crud" ON public.meta_templates;
CREATE POLICY "org_members_crud" ON public.meta_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM instances i
      JOIN organization_members om ON om.organization_id = i.organization_id
      WHERE i.id = meta_templates.instance_id AND om.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin_master')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM instances i
      JOIN organization_members om ON om.organization_id = i.organization_id
      WHERE i.id = meta_templates.instance_id AND om.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin_master')
  );

-- meta_conversation_windows (SELECT policy with JOIN)
DROP POLICY IF EXISTS "Org members can view meta windows" ON public.meta_conversation_windows;
CREATE POLICY "Org members can view meta windows" ON public.meta_conversation_windows
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      JOIN organization_members om ON om.organization_id = ct.organization_id
      WHERE c.id = meta_conversation_windows.conversation_id AND om.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin_master')
  );
