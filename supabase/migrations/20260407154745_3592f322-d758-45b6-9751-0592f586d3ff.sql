
-- ============================================================
-- FEATURE 1: Drop all residual {public} role policies
-- (keeping only intentional public access for saas_settings)
-- ============================================================

-- files
DROP POLICY IF EXISTS "Users can delete their own files" ON public.files;

-- flow_sessions (4 public policies)
DROP POLICY IF EXISTS "Users can delete their own flow sessions" ON public.flow_sessions;
DROP POLICY IF EXISTS "Users can insert their own flow sessions" ON public.flow_sessions;
DROP POLICY IF EXISTS "Users can update their own flow sessions" ON public.flow_sessions;
DROP POLICY IF EXISTS "Users can view their own flow sessions" ON public.flow_sessions;

-- followup_templates (4)
DROP POLICY IF EXISTS "Members can delete org templates" ON public.followup_templates;
DROP POLICY IF EXISTS "Members can insert org templates" ON public.followup_templates;
DROP POLICY IF EXISTS "Members can update org templates" ON public.followup_templates;
DROP POLICY IF EXISTS "Members can view org templates" ON public.followup_templates;

-- instances (4)
DROP POLICY IF EXISTS "Users can delete their organization instances" ON public.instances;
DROP POLICY IF EXISTS "Users can insert their organization instances" ON public.instances;
DROP POLICY IF EXISTS "Users can update their organization instances" ON public.instances;
DROP POLICY IF EXISTS "Users can view their organization instances via view" ON public.instances;

-- integrations (4)
DROP POLICY IF EXISTS "Users can delete their own integration" ON public.integrations;
DROP POLICY IF EXISTS "Users can insert their own integration" ON public.integrations;
DROP POLICY IF EXISTS "Users can update their own integration" ON public.integrations;
DROP POLICY IF EXISTS "Users can view their own integration basic info" ON public.integrations;

-- mcp_server_configs (4)
DROP POLICY IF EXISTS "Members can delete their org MCP configs" ON public.mcp_server_configs;
DROP POLICY IF EXISTS "Members can insert their org MCP configs" ON public.mcp_server_configs;
DROP POLICY IF EXISTS "Members can update their org MCP configs" ON public.mcp_server_configs;
DROP POLICY IF EXISTS "Members can view their org MCP configs" ON public.mcp_server_configs;

-- message_templates (1 SELECT)
DROP POLICY IF EXISTS "Users can view their own templates and defaults" ON public.message_templates;

-- organization_members (3)
DROP POLICY IF EXISTS "Admin master can do everything on members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can manage all organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.organization_members;

-- organizations (1 SELECT)
DROP POLICY IF EXISTS "Owner can view their organization" ON public.organizations;

-- pipeline_keyword_rules (3)
DROP POLICY IF EXISTS "Owners can delete org keyword rules" ON public.pipeline_keyword_rules;
DROP POLICY IF EXISTS "Owners can insert org keyword rules" ON public.pipeline_keyword_rules;
DROP POLICY IF EXISTS "Owners can update org keyword rules" ON public.pipeline_keyword_rules;

-- pipelines (4)
DROP POLICY IF EXISTS "Users can delete their organization pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Users can insert their organization pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Users can update their organization pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Users can view their organization pipelines" ON public.pipelines;

-- prospect_providers (4)
DROP POLICY IF EXISTS "Deny direct SELECT on prospect_providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Owners can delete their prospect providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Owners can insert prospect providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Owners can update their prospect providers" ON public.prospect_providers;

-- prospect_results (1 UPDATE)
DROP POLICY IF EXISTS "Users can update their organization results" ON public.prospect_results;

-- quick_replies (4)
DROP POLICY IF EXISTS "Members can delete org quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Members can insert org quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Members can update org quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Members can view org quick replies" ON public.quick_replies;

-- routing_rules (4)
DROP POLICY IF EXISTS "Users can delete their own routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Users can insert their own routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Users can update their own routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Users can view their own routing rules" ON public.routing_rules;

-- saas_settings: Keep "Public can read public settings" and "Admin master can manage settings"
-- but migrate admin policy to authenticated
DROP POLICY IF EXISTS "Admin master can manage settings" ON public.saas_settings;
CREATE POLICY "Admin master can manage settings" ON public.saas_settings FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

-- session_responses (1 UPDATE)
DROP POLICY IF EXISTS "Users can update their own session responses" ON public.session_responses;

-- stages (4)
DROP POLICY IF EXISTS "Users can delete stages in their pipelines" ON public.stages;
DROP POLICY IF EXISTS "Users can insert stages in their pipelines" ON public.stages;
DROP POLICY IF EXISTS "Users can update stages in their pipelines" ON public.stages;
DROP POLICY IF EXISTS "Users can view stages of their pipelines" ON public.stages;

-- subscription_payments (2)
DROP POLICY IF EXISTS "Admin master can do everything on payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Org owners can view their organization payments" ON public.subscription_payments;

-- subscription_plans: Keep "Anyone can view active public plans" (intentionally public)
-- but migrate admin policy to authenticated
DROP POLICY IF EXISTS "Admin master can manage all plans" ON public.subscription_plans;
CREATE POLICY "Admin master can manage all plans" ON public.subscription_plans FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

-- subscriptions (1 SELECT)
DROP POLICY IF EXISTS "Users can view their organization subscription" ON public.subscriptions;

-- trial_records (1 SELECT)
DROP POLICY IF EXISTS "Users can view their own trial records" ON public.trial_records;

-- tutorial_categories (2)
DROP POLICY IF EXISTS "Admin master can manage categories" ON public.tutorial_categories;
DROP POLICY IF EXISTS "Authenticated users can view active categories" ON public.tutorial_categories;
-- Re-create on authenticated role
CREATE POLICY "Admin master can manage categories" ON public.tutorial_categories FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());
CREATE POLICY "Authenticated users can view active categories" ON public.tutorial_categories FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL AND is_active = true);

-- tutorials (1 admin ALL)
DROP POLICY IF EXISTS "Admin master can manage tutorials" ON public.tutorials;
CREATE POLICY "Admin master can manage tutorials" ON public.tutorials FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

-- usage_logs (2)
DROP POLICY IF EXISTS "System can insert usage logs" ON public.usage_logs;
DROP POLICY IF EXISTS "Users can view their organization usage" ON public.usage_logs;

-- usage_summary (1)
DROP POLICY IF EXISTS "Users can view their organization summary" ON public.usage_summary;

-- user_onboarding (3)
DROP POLICY IF EXISTS "Users can insert own onboarding" ON public.user_onboarding;
DROP POLICY IF EXISTS "Users can read own onboarding" ON public.user_onboarding;
DROP POLICY IF EXISTS "Users can update own onboarding" ON public.user_onboarding;

-- voice_campaigns (4)
DROP POLICY IF EXISTS "Users can delete their org voice campaigns" ON public.voice_campaigns;
DROP POLICY IF EXISTS "Users can insert their org voice campaigns" ON public.voice_campaigns;
DROP POLICY IF EXISTS "Users can update their org voice campaigns" ON public.voice_campaigns;
DROP POLICY IF EXISTS "Users can view their org voice campaigns" ON public.voice_campaigns;

-- Check if subscription_payments has authenticated duplicates, if not create them
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_payments' AND roles::text LIKE '%{authenticated}%' AND policyname LIKE 'Admin%') THEN
    EXECUTE 'CREATE POLICY "Admin master can manage payments" ON public.subscription_payments FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_payments' AND roles::text LIKE '%{authenticated}%' AND cmd = 'SELECT' AND policyname LIKE 'Org%') THEN
    EXECUTE 'CREATE POLICY "Org owners can view their payments" ON public.subscription_payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM organizations o WHERE o.id = subscription_payments.organization_id AND o.owner_user_id = auth.uid()))';
  END IF;
  -- subscriptions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND roles::text LIKE '%{authenticated}%' AND cmd = 'SELECT' AND policyname LIKE 'Members%view%') THEN
    EXECUTE 'CREATE POLICY "Members can view their org subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())))';
  END IF;
  -- trial_records
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trial_records' AND roles::text LIKE '%{authenticated}%' AND cmd = 'SELECT') THEN
    EXECUTE 'CREATE POLICY "Users can view their trial records" ON public.trial_records FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;
  -- usage_summary
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'usage_summary' AND roles::text LIKE '%{authenticated}%' AND cmd = 'SELECT') THEN
    EXECUTE 'CREATE POLICY "Members can view their org usage summary" ON public.usage_summary FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())))';
  END IF;
  -- usage_logs (need both SELECT and INSERT)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'usage_logs' AND roles::text LIKE '%{authenticated}%' AND cmd = 'SELECT') THEN
    EXECUTE 'CREATE POLICY "Members can view their org usage logs" ON public.usage_logs FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'usage_logs' AND roles::text LIKE '%{authenticated}%' AND cmd = 'INSERT') THEN
    EXECUTE 'CREATE POLICY "Members can insert their org usage logs" ON public.usage_logs FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())))';
  END IF;
  -- user_onboarding
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_onboarding' AND roles::text LIKE '%{authenticated}%' AND cmd = 'SELECT') THEN
    EXECUTE 'CREATE POLICY "Users can read their onboarding" ON public.user_onboarding FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_onboarding' AND roles::text LIKE '%{authenticated}%' AND cmd = 'INSERT') THEN
    EXECUTE 'CREATE POLICY "Users can insert their onboarding" ON public.user_onboarding FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_onboarding' AND roles::text LIKE '%{authenticated}%' AND cmd = 'UPDATE') THEN
    EXECUTE 'CREATE POLICY "Users can update their onboarding" ON public.user_onboarding FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;


-- ============================================================
-- FEATURE 2: Add WITH CHECK to all UPDATE policies missing it
-- This prevents users from changing ownership fields
-- ============================================================

-- For user_id-based tables: WITH CHECK ensures user_id stays as auth.uid()
DROP POLICY IF EXISTS "Users can update their reengagement configs" ON public.auto_reengagement_config;
CREATE POLICY "Users can update their reengagement configs" ON public.auto_reengagement_config FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their reengagement queue" ON public.auto_reengagement_queue;
CREATE POLICY "Users can update their reengagement queue" ON public.auto_reengagement_queue FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their connector events" ON public.connector_events;
CREATE POLICY "Users can update their connector events" ON public.connector_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- For organization_id-based tables: WITH CHECK ensures org stays in user's orgs
DROP POLICY IF EXISTS "Members can update their org contact attachments" ON public.contact_attachments;
CREATE POLICY "Members can update their org contact attachments" ON public.contact_attachments FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org contact notes" ON public.contact_notes;
CREATE POLICY "Members can update their org contact notes" ON public.contact_notes FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org contacts" ON public.contacts;
CREATE POLICY "Members can update their org contacts" ON public.contacts FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org conversations" ON public.conversations;
CREATE POLICY "Members can update their org conversations" ON public.conversations FOR UPDATE TO authenticated
  USING (contact_id IN (SELECT contacts.id FROM contacts WHERE contacts.organization_id IN (SELECT get_user_organization_ids(auth.uid()))))
  WITH CHECK (contact_id IN (SELECT contacts.id FROM contacts WHERE contacts.organization_id IN (SELECT get_user_organization_ids(auth.uid()))));

DROP POLICY IF EXISTS "Users can update their event actions" ON public.event_actions;
CREATE POLICY "Users can update their event actions" ON public.event_actions FOR UPDATE TO authenticated
  USING (event_id IN (SELECT events.id FROM events WHERE events.user_id = auth.uid()))
  WITH CHECK (event_id IN (SELECT events.id FROM events WHERE events.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their events" ON public.events;
CREATE POLICY "Users can update their events" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their flow sessions" ON public.flow_sessions;
CREATE POLICY "Users can update their flow sessions" ON public.flow_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their flow steps" ON public.flow_steps;
CREATE POLICY "Users can update their flow steps" ON public.flow_steps FOR UPDATE TO authenticated
  USING (flow_id IN (SELECT flows.id FROM flows WHERE flows.user_id = auth.uid()))
  WITH CHECK (flow_id IN (SELECT flows.id FROM flows WHERE flows.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their flows" ON public.flows;
CREATE POLICY "Users can update their flows" ON public.flows FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can update their org followup templates" ON public.followup_templates;
CREATE POLICY "Members can update their org followup templates" ON public.followup_templates FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org instagram accounts" ON public.instagram_accounts;
CREATE POLICY "Members can update their org instagram accounts" ON public.instagram_accounts FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org instagram app config" ON public.instagram_app_config;
CREATE POLICY "Members can update their org instagram app config" ON public.instagram_app_config FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org instagram automations" ON public.instagram_automations;
CREATE POLICY "Members can update their org instagram automations" ON public.instagram_automations FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org instagram jobs" ON public.instagram_jobs;
CREATE POLICY "Members can update their org instagram jobs" ON public.instagram_jobs FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org instagram templates" ON public.instagram_templates;
CREATE POLICY "Members can update their org instagram templates" ON public.instagram_templates FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org instances" ON public.instances;
CREATE POLICY "Members can update their org instances" ON public.instances FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their integrations" ON public.integrations;
CREATE POLICY "Users can update their integrations" ON public.integrations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can update their org MCP connections" ON public.mcp_connections;
CREATE POLICY "Members can update their org MCP connections" ON public.mcp_connections FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org MCP server configs" ON public.mcp_server_configs;
CREATE POLICY "Members can update their org MCP server configs" ON public.mcp_server_configs FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their message templates" ON public.message_templates;
CREATE POLICY "Users can update their message templates" ON public.message_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their organization messages" ON public.messages;
CREATE POLICY "Users can update their organization messages" ON public.messages FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org pipeline keyword rules" ON public.pipeline_keyword_rules;
CREATE POLICY "Members can update their org pipeline keyword rules" ON public.pipeline_keyword_rules FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org pipelines" ON public.pipelines;
CREATE POLICY "Members can update their org pipelines" ON public.pipelines FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org prospect providers" ON public.prospect_providers;
CREATE POLICY "Members can update their org prospect providers" ON public.prospect_providers FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org prospect results" ON public.prospect_results;
CREATE POLICY "Members can update their org prospect results" ON public.prospect_results FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org prospect searches" ON public.prospect_searches;
CREATE POLICY "Members can update their org prospect searches" ON public.prospect_searches FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org quick replies" ON public.quick_replies;
CREATE POLICY "Members can update their org quick replies" ON public.quick_replies FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their routing rules" ON public.routing_rules;
CREATE POLICY "Users can update their routing rules" ON public.routing_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their session responses" ON public.session_responses;
CREATE POLICY "Users can update their session responses" ON public.session_responses FOR UPDATE TO authenticated
  USING (session_id IN (SELECT flow_sessions.id FROM flow_sessions WHERE flow_sessions.user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT flow_sessions.id FROM flow_sessions WHERE flow_sessions.user_id = auth.uid()));

DROP POLICY IF EXISTS "Members can update their org stages" ON public.stages;
CREATE POLICY "Members can update their org stages" ON public.stages FOR UPDATE TO authenticated
  USING (pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.organization_id IN (SELECT get_user_organization_ids(auth.uid()))))
  WITH CHECK (pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.organization_id IN (SELECT get_user_organization_ids(auth.uid()))));

DROP POLICY IF EXISTS "Org owners can update team profiles" ON public.team_profiles;
CREATE POLICY "Org owners can update team profiles" ON public.team_profiles FOR UPDATE TO authenticated
  USING (is_organization_owner(organization_id, auth.uid()) OR has_role(auth.uid(), 'admin_master'::app_role))
  WITH CHECK (is_organization_owner(organization_id, auth.uid()) OR has_role(auth.uid(), 'admin_master'::app_role));

DROP POLICY IF EXISTS "Members can update their org voice campaigns" ON public.voice_campaigns;
CREATE POLICY "Members can update their org voice campaigns" ON public.voice_campaigns FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org voice campaign contacts" ON public.voice_campaign_contacts;
CREATE POLICY "Members can update their org voice campaign contacts" ON public.voice_campaign_contacts FOR UPDATE TO authenticated
  USING (campaign_id IN (SELECT voice_campaigns.id FROM voice_campaigns WHERE voice_campaigns.organization_id IN (SELECT get_user_organization_ids(auth.uid()))))
  WITH CHECK (campaign_id IN (SELECT voice_campaigns.id FROM voice_campaigns WHERE voice_campaigns.organization_id IN (SELECT get_user_organization_ids(auth.uid()))));

DROP POLICY IF EXISTS "Members can update their org scrape sessions" ON public.visual_scrape_sessions;
CREATE POLICY "Members can update their org scrape sessions" ON public.visual_scrape_sessions FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update their org voice calls" ON public.voice_calls;
CREATE POLICY "Members can update their org voice calls" ON public.voice_calls FOR UPDATE TO authenticated
  USING (contact_id IN (SELECT contacts.id FROM contacts WHERE contacts.organization_id IN (SELECT get_user_organization_ids(auth.uid()))))
  WITH CHECK (contact_id IN (SELECT contacts.id FROM contacts WHERE contacts.organization_id IN (SELECT get_user_organization_ids(auth.uid()))));

DROP POLICY IF EXISTS "Users can update their webhook connectors" ON public.webhook_connectors;
CREATE POLICY "Users can update their webhook connectors" ON public.webhook_connectors FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
