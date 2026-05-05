
-- 1. REALTIME
ALTER PUBLICATION supabase_realtime DROP TABLE public.connector_events;
ALTER PUBLICATION supabase_realtime DROP TABLE public.instagram_events;
ALTER PUBLICATION supabase_realtime DROP TABLE public.instagram_action_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.conversation_evaluations;

-- 2. MCP CONNECTIONS
ALTER TABLE public.mcp_connections ALTER COLUMN access_token DROP NOT NULL;
DROP POLICY IF EXISTS "Members can insert their org MCP connections" ON public.mcp_connections;
DROP POLICY IF EXISTS "Members can update their org MCP connections" ON public.mcp_connections;
DROP POLICY IF EXISTS "Members can delete their org MCP connections" ON public.mcp_connections;
CREATE POLICY "Members can insert their org MCP connections" ON public.mcp_connections FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org MCP connections" ON public.mcp_connections FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org MCP connections" ON public.mcp_connections FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- 3. MESSAGES (fix INSERT + migrate)
DROP POLICY IF EXISTS "Users can insert their organization messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view their organization messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their organization messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their organization messages" ON public.messages;
CREATE POLICY "Users can view their organization messages" ON public.messages FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Users can insert their organization messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Users can update their organization messages" ON public.messages FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Users can delete their organization messages" ON public.messages FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- 4. STORAGE duplicate
DROP POLICY IF EXISTS "Org members can view their message media" ON storage.objects;

-- 5. INSTAGRAM APP CONFIG
DROP POLICY IF EXISTS "Members can view their org instagram app config" ON public.instagram_app_config;
DROP POLICY IF EXISTS "Owners can view their org instagram app config" ON public.instagram_app_config;
DROP POLICY IF EXISTS "Members can insert their org instagram app config" ON public.instagram_app_config;
DROP POLICY IF EXISTS "Members can update their org instagram app config" ON public.instagram_app_config;
DROP POLICY IF EXISTS "Members can delete their org instagram app config" ON public.instagram_app_config;
CREATE POLICY "Owners can view their org instagram app config" ON public.instagram_app_config FOR SELECT TO authenticated USING (is_organization_owner(organization_id, auth.uid()) OR is_admin_master());
CREATE POLICY "Members can insert their org instagram app config" ON public.instagram_app_config FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram app config" ON public.instagram_app_config FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org instagram app config" ON public.instagram_app_config FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- 6. BULK PUBLIC→AUTHENTICATED (user_id based tables)
DROP POLICY IF EXISTS "Users can view their reengagement configs" ON public.auto_reengagement_config;
DROP POLICY IF EXISTS "Users can create their reengagement configs" ON public.auto_reengagement_config;
DROP POLICY IF EXISTS "Users can update their reengagement configs" ON public.auto_reengagement_config;
DROP POLICY IF EXISTS "Users can delete their reengagement configs" ON public.auto_reengagement_config;
CREATE POLICY "Users can view their reengagement configs" ON public.auto_reengagement_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their reengagement configs" ON public.auto_reengagement_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their reengagement configs" ON public.auto_reengagement_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their reengagement configs" ON public.auto_reengagement_config FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their reengagement queue" ON public.auto_reengagement_queue;
DROP POLICY IF EXISTS "Users can create reengagement queue items" ON public.auto_reengagement_queue;
DROP POLICY IF EXISTS "Users can update their reengagement queue" ON public.auto_reengagement_queue;
DROP POLICY IF EXISTS "Users can delete their reengagement queue" ON public.auto_reengagement_queue;
CREATE POLICY "Users can view their reengagement queue" ON public.auto_reengagement_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create reengagement queue items" ON public.auto_reengagement_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their reengagement queue" ON public.auto_reengagement_queue FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their reengagement queue" ON public.auto_reengagement_queue FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their connector events" ON public.connector_events;
DROP POLICY IF EXISTS "Users can insert their connector events" ON public.connector_events;
DROP POLICY IF EXISTS "Users can update their connector events" ON public.connector_events;
DROP POLICY IF EXISTS "Users can delete their connector events" ON public.connector_events;
CREATE POLICY "Users can view their connector events" ON public.connector_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their connector events" ON public.connector_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their connector events" ON public.connector_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their connector events" ON public.connector_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their events" ON public.events;
DROP POLICY IF EXISTS "Users can insert their events" ON public.events;
DROP POLICY IF EXISTS "Users can update their events" ON public.events;
CREATE POLICY "Users can view their events" ON public.events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their events" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their files" ON public.files;
DROP POLICY IF EXISTS "Users can insert their files" ON public.files;
DROP POLICY IF EXISTS "Users can delete their files" ON public.files;
CREATE POLICY "Users can view their files" ON public.files FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their files" ON public.files FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their files" ON public.files FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their flow sessions" ON public.flow_sessions;
DROP POLICY IF EXISTS "Users can insert their flow sessions" ON public.flow_sessions;
DROP POLICY IF EXISTS "Users can update their flow sessions" ON public.flow_sessions;
DROP POLICY IF EXISTS "Users can delete their flow sessions" ON public.flow_sessions;
CREATE POLICY "Users can view their flow sessions" ON public.flow_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their flow sessions" ON public.flow_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their flow sessions" ON public.flow_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their flow sessions" ON public.flow_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their flows" ON public.flows;
DROP POLICY IF EXISTS "Users can insert their flows" ON public.flows;
DROP POLICY IF EXISTS "Users can update their flows" ON public.flows;
DROP POLICY IF EXISTS "Users can delete their flows" ON public.flows;
CREATE POLICY "Users can view their flows" ON public.flows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their flows" ON public.flows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their flows" ON public.flows FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their flows" ON public.flows FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Users can insert their routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Users can update their routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Users can delete their routing rules" ON public.routing_rules;
CREATE POLICY "Users can view their routing rules" ON public.routing_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their routing rules" ON public.routing_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their routing rules" ON public.routing_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their routing rules" ON public.routing_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can insert their message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can update their message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can delete their message templates" ON public.message_templates;
CREATE POLICY "Users can view their message templates" ON public.message_templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their message templates" ON public.message_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their message templates" ON public.message_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their message templates" ON public.message_templates FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their webhook connectors" ON public.webhook_connectors;
DROP POLICY IF EXISTS "Users can insert their webhook connectors" ON public.webhook_connectors;
DROP POLICY IF EXISTS "Users can update their webhook connectors" ON public.webhook_connectors;
DROP POLICY IF EXISTS "Users can delete their webhook connectors" ON public.webhook_connectors;
CREATE POLICY "Users can view their webhook connectors" ON public.webhook_connectors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their webhook connectors" ON public.webhook_connectors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their webhook connectors" ON public.webhook_connectors FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their webhook connectors" ON public.webhook_connectors FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their onboarding" ON public.user_onboarding;
DROP POLICY IF EXISTS "Users can insert their onboarding" ON public.user_onboarding;
DROP POLICY IF EXISTS "Users can update their onboarding" ON public.user_onboarding;
CREATE POLICY "Users can view their onboarding" ON public.user_onboarding FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their onboarding" ON public.user_onboarding FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their onboarding" ON public.user_onboarding FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin_master());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

DROP POLICY IF EXISTS "Members can view their org integrations" ON public.integrations;
DROP POLICY IF EXISTS "Members can insert their org integrations" ON public.integrations;
DROP POLICY IF EXISTS "Members can update their org integrations" ON public.integrations;
DROP POLICY IF EXISTS "Members can delete their org integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can view their integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can insert their integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can update their integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can delete their integrations" ON public.integrations;
CREATE POLICY "Users can view their integrations" ON public.integrations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their integrations" ON public.integrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their integrations" ON public.integrations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their integrations" ON public.integrations FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own redemptions" ON public.coupon_redemptions;
DROP POLICY IF EXISTS "Users can create their own redemptions" ON public.coupon_redemptions;
CREATE POLICY "Users can view their own redemptions" ON public.coupon_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own redemptions" ON public.coupon_redemptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their trial records" ON public.trial_records;
DROP POLICY IF EXISTS "Users can insert their trial records" ON public.trial_records;
CREATE POLICY "Users can view their trial records" ON public.trial_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their trial records" ON public.trial_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- flow_steps (via flow)
DROP POLICY IF EXISTS "Users can view their flow steps" ON public.flow_steps;
DROP POLICY IF EXISTS "Users can insert their flow steps" ON public.flow_steps;
DROP POLICY IF EXISTS "Users can update their flow steps" ON public.flow_steps;
DROP POLICY IF EXISTS "Users can delete their flow steps" ON public.flow_steps;
CREATE POLICY "Users can view their flow steps" ON public.flow_steps FOR SELECT TO authenticated USING (flow_id IN (SELECT id FROM flows WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert their flow steps" ON public.flow_steps FOR INSERT TO authenticated WITH CHECK (flow_id IN (SELECT id FROM flows WHERE user_id = auth.uid()));
CREATE POLICY "Users can update their flow steps" ON public.flow_steps FOR UPDATE TO authenticated USING (flow_id IN (SELECT id FROM flows WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete their flow steps" ON public.flow_steps FOR DELETE TO authenticated USING (flow_id IN (SELECT id FROM flows WHERE user_id = auth.uid()));

-- event_actions (via event)
DROP POLICY IF EXISTS "Users can view their event actions" ON public.event_actions;
DROP POLICY IF EXISTS "Users can insert their event actions" ON public.event_actions;
DROP POLICY IF EXISTS "Users can update their event actions" ON public.event_actions;
CREATE POLICY "Users can view their event actions" ON public.event_actions FOR SELECT TO authenticated USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert their event actions" ON public.event_actions FOR INSERT TO authenticated WITH CHECK (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));
CREATE POLICY "Users can update their event actions" ON public.event_actions FOR UPDATE TO authenticated USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));

-- session_responses (via session)
DROP POLICY IF EXISTS "Users can view their session responses" ON public.session_responses;
DROP POLICY IF EXISTS "Users can insert their session responses" ON public.session_responses;
DROP POLICY IF EXISTS "Users can update their session responses" ON public.session_responses;
CREATE POLICY "Users can view their session responses" ON public.session_responses FOR SELECT TO authenticated USING (session_id IN (SELECT id FROM flow_sessions WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert their session responses" ON public.session_responses FOR INSERT TO authenticated WITH CHECK (session_id IN (SELECT id FROM flow_sessions WHERE user_id = auth.uid()));
CREATE POLICY "Users can update their session responses" ON public.session_responses FOR UPDATE TO authenticated USING (session_id IN (SELECT id FROM flow_sessions WHERE user_id = auth.uid()));

-- 7. ORGANIZATION_ID based tables
DROP POLICY IF EXISTS "Members can view their org contact attachments" ON public.contact_attachments;
DROP POLICY IF EXISTS "Members can insert their org contact attachments" ON public.contact_attachments;
DROP POLICY IF EXISTS "Members can update their org contact attachments" ON public.contact_attachments;
DROP POLICY IF EXISTS "Members can delete their org contact attachments" ON public.contact_attachments;
CREATE POLICY "Members can view their org contact attachments" ON public.contact_attachments FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org contact attachments" ON public.contact_attachments FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org contact attachments" ON public.contact_attachments FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org contact attachments" ON public.contact_attachments FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org contact notes" ON public.contact_notes;
DROP POLICY IF EXISTS "Members can insert their org contact notes" ON public.contact_notes;
DROP POLICY IF EXISTS "Members can update their org contact notes" ON public.contact_notes;
DROP POLICY IF EXISTS "Members can delete their org contact notes" ON public.contact_notes;
CREATE POLICY "Members can view their org contact notes" ON public.contact_notes FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org contact notes" ON public.contact_notes FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org contact notes" ON public.contact_notes FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org contact notes" ON public.contact_notes FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org contacts" ON public.contacts;
DROP POLICY IF EXISTS "Members can insert their org contacts" ON public.contacts;
DROP POLICY IF EXISTS "Members can update their org contacts" ON public.contacts;
DROP POLICY IF EXISTS "Members can delete their org contacts" ON public.contacts;
CREATE POLICY "Members can view their org contacts" ON public.contacts FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org contacts" ON public.contacts FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org contacts" ON public.contacts FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org CRM config" ON public.crm_openbot_config;
DROP POLICY IF EXISTS "Members can insert their org CRM config" ON public.crm_openbot_config;
DROP POLICY IF EXISTS "Members can update their org CRM config" ON public.crm_openbot_config;
DROP POLICY IF EXISTS "Members can delete their org CRM config" ON public.crm_openbot_config;
CREATE POLICY "Members can view their org CRM config" ON public.crm_openbot_config FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org CRM config" ON public.crm_openbot_config FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org CRM config" ON public.crm_openbot_config FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org CRM config" ON public.crm_openbot_config FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org webhook events" ON public.crm_webhook_events;
DROP POLICY IF EXISTS "Members can insert their org webhook events" ON public.crm_webhook_events;
CREATE POLICY "Members can view their org webhook events" ON public.crm_webhook_events FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org webhook events" ON public.crm_webhook_events FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org followup templates" ON public.followup_templates;
DROP POLICY IF EXISTS "Members can insert their org followup templates" ON public.followup_templates;
DROP POLICY IF EXISTS "Members can update their org followup templates" ON public.followup_templates;
DROP POLICY IF EXISTS "Members can delete their org followup templates" ON public.followup_templates;
CREATE POLICY "Members can view their org followup templates" ON public.followup_templates FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org followup templates" ON public.followup_templates FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org followup templates" ON public.followup_templates FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org followup templates" ON public.followup_templates FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org instagram accounts" ON public.instagram_accounts;
DROP POLICY IF EXISTS "Members can insert their org instagram accounts" ON public.instagram_accounts;
DROP POLICY IF EXISTS "Members can update their org instagram accounts" ON public.instagram_accounts;
DROP POLICY IF EXISTS "Members can delete their org instagram accounts" ON public.instagram_accounts;
CREATE POLICY "Members can view their org instagram accounts" ON public.instagram_accounts FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram accounts" ON public.instagram_accounts FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram accounts" ON public.instagram_accounts FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org instagram accounts" ON public.instagram_accounts FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org instagram action logs" ON public.instagram_action_logs;
DROP POLICY IF EXISTS "Members can insert their org instagram action logs" ON public.instagram_action_logs;
CREATE POLICY "Members can view their org instagram action logs" ON public.instagram_action_logs FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram action logs" ON public.instagram_action_logs FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org instagram automations" ON public.instagram_automations;
DROP POLICY IF EXISTS "Members can insert their org instagram automations" ON public.instagram_automations;
DROP POLICY IF EXISTS "Members can update their org instagram automations" ON public.instagram_automations;
DROP POLICY IF EXISTS "Members can delete their org instagram automations" ON public.instagram_automations;
CREATE POLICY "Members can view their org instagram automations" ON public.instagram_automations FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram automations" ON public.instagram_automations FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram automations" ON public.instagram_automations FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org instagram automations" ON public.instagram_automations FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org instagram events" ON public.instagram_events;
DROP POLICY IF EXISTS "Members can insert their org instagram events" ON public.instagram_events;
CREATE POLICY "Members can view their org instagram events" ON public.instagram_events FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram events" ON public.instagram_events FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org instagram jobs" ON public.instagram_jobs;
DROP POLICY IF EXISTS "Members can insert their org instagram jobs" ON public.instagram_jobs;
DROP POLICY IF EXISTS "Members can update their org instagram jobs" ON public.instagram_jobs;
CREATE POLICY "Members can view their org instagram jobs" ON public.instagram_jobs FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram jobs" ON public.instagram_jobs FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram jobs" ON public.instagram_jobs FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org instagram leads" ON public.instagram_leads;
DROP POLICY IF EXISTS "Members can insert their org instagram leads" ON public.instagram_leads;
DROP POLICY IF EXISTS "Members can update their org instagram leads" ON public.instagram_leads;
CREATE POLICY "Members can view their org instagram leads" ON public.instagram_leads FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram leads" ON public.instagram_leads FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram leads" ON public.instagram_leads FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org instagram sessions" ON public.instagram_sessions;
DROP POLICY IF EXISTS "Members can insert their org instagram sessions" ON public.instagram_sessions;
DROP POLICY IF EXISTS "Members can update their org instagram sessions" ON public.instagram_sessions;
CREATE POLICY "Members can view their org instagram sessions" ON public.instagram_sessions FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram sessions" ON public.instagram_sessions FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram sessions" ON public.instagram_sessions FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org instagram templates" ON public.instagram_templates;
DROP POLICY IF EXISTS "Members can insert their org instagram templates" ON public.instagram_templates;
DROP POLICY IF EXISTS "Members can update their org instagram templates" ON public.instagram_templates;
DROP POLICY IF EXISTS "Members can delete their org instagram templates" ON public.instagram_templates;
CREATE POLICY "Members can view their org instagram templates" ON public.instagram_templates FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instagram templates" ON public.instagram_templates FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instagram templates" ON public.instagram_templates FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org instagram templates" ON public.instagram_templates FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org instances" ON public.instances;
DROP POLICY IF EXISTS "Members can insert their org instances" ON public.instances;
DROP POLICY IF EXISTS "Members can update their org instances" ON public.instances;
DROP POLICY IF EXISTS "Members can delete their org instances" ON public.instances;
CREATE POLICY "Members can view their org instances" ON public.instances FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org instances" ON public.instances FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org instances" ON public.instances FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org instances" ON public.instances FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org MCP server configs" ON public.mcp_server_configs;
DROP POLICY IF EXISTS "Members can insert their org MCP server configs" ON public.mcp_server_configs;
DROP POLICY IF EXISTS "Members can update their org MCP server configs" ON public.mcp_server_configs;
DROP POLICY IF EXISTS "Members can delete their org MCP server configs" ON public.mcp_server_configs;
CREATE POLICY "Members can view their org MCP server configs" ON public.mcp_server_configs FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org MCP server configs" ON public.mcp_server_configs FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org MCP server configs" ON public.mcp_server_configs FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org MCP server configs" ON public.mcp_server_configs FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org pipeline keyword rules" ON public.pipeline_keyword_rules;
DROP POLICY IF EXISTS "Members can insert their org pipeline keyword rules" ON public.pipeline_keyword_rules;
DROP POLICY IF EXISTS "Members can update their org pipeline keyword rules" ON public.pipeline_keyword_rules;
DROP POLICY IF EXISTS "Members can delete their org pipeline keyword rules" ON public.pipeline_keyword_rules;
CREATE POLICY "Members can view their org pipeline keyword rules" ON public.pipeline_keyword_rules FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org pipeline keyword rules" ON public.pipeline_keyword_rules FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org pipeline keyword rules" ON public.pipeline_keyword_rules FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org pipeline keyword rules" ON public.pipeline_keyword_rules FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Members can insert their org pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Members can update their org pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Members can delete their org pipelines" ON public.pipelines;
CREATE POLICY "Members can view their org pipelines" ON public.pipelines FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org pipelines" ON public.pipelines FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org pipelines" ON public.pipelines FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org pipelines" ON public.pipelines FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org prospect providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Members can insert their org prospect providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Members can update their org prospect providers" ON public.prospect_providers;
DROP POLICY IF EXISTS "Members can delete their org prospect providers" ON public.prospect_providers;
CREATE POLICY "Members can view their org prospect providers" ON public.prospect_providers FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org prospect providers" ON public.prospect_providers FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org prospect providers" ON public.prospect_providers FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org prospect providers" ON public.prospect_providers FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org prospect results" ON public.prospect_results;
DROP POLICY IF EXISTS "Members can insert their org prospect results" ON public.prospect_results;
DROP POLICY IF EXISTS "Members can update their org prospect results" ON public.prospect_results;
CREATE POLICY "Members can view their org prospect results" ON public.prospect_results FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org prospect results" ON public.prospect_results FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org prospect results" ON public.prospect_results FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org prospect searches" ON public.prospect_searches;
DROP POLICY IF EXISTS "Members can insert their org prospect searches" ON public.prospect_searches;
DROP POLICY IF EXISTS "Members can update their org prospect searches" ON public.prospect_searches;
CREATE POLICY "Members can view their org prospect searches" ON public.prospect_searches FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org prospect searches" ON public.prospect_searches FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org prospect searches" ON public.prospect_searches FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Members can insert their org quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Members can update their org quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Members can delete their org quick replies" ON public.quick_replies;
CREATE POLICY "Members can view their org quick replies" ON public.quick_replies FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org quick replies" ON public.quick_replies FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org quick replies" ON public.quick_replies FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org quick replies" ON public.quick_replies FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org voice campaigns" ON public.voice_campaigns;
DROP POLICY IF EXISTS "Members can insert their org voice campaigns" ON public.voice_campaigns;
DROP POLICY IF EXISTS "Members can update their org voice campaigns" ON public.voice_campaigns;
DROP POLICY IF EXISTS "Members can delete their org voice campaigns" ON public.voice_campaigns;
CREATE POLICY "Members can view their org voice campaigns" ON public.voice_campaigns FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org voice campaigns" ON public.voice_campaigns FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org voice campaigns" ON public.voice_campaigns FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can delete their org voice campaigns" ON public.voice_campaigns FOR DELETE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their org scrape sessions" ON public.visual_scrape_sessions;
DROP POLICY IF EXISTS "Members can insert their org scrape sessions" ON public.visual_scrape_sessions;
DROP POLICY IF EXISTS "Members can update their org scrape sessions" ON public.visual_scrape_sessions;
CREATE POLICY "Members can view their org scrape sessions" ON public.visual_scrape_sessions FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can insert their org scrape sessions" ON public.visual_scrape_sessions FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update their org scrape sessions" ON public.visual_scrape_sessions FOR UPDATE TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- usage_logs (organization_id)
DROP POLICY IF EXISTS "Users can view their usage logs" ON public.usage_logs;
DROP POLICY IF EXISTS "Users can insert their usage logs" ON public.usage_logs;
CREATE POLICY "Users can view their usage logs" ON public.usage_logs FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Users can insert their usage logs" ON public.usage_logs FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- usage_summary (organization_id)
DROP POLICY IF EXISTS "Users can view their usage summary" ON public.usage_summary;
CREATE POLICY "Users can view their usage summary" ON public.usage_summary FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- subscription_payments
DROP POLICY IF EXISTS "Members can view their org payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.subscription_payments;
CREATE POLICY "Members can view their org payments" ON public.subscription_payments FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Admins can manage all payments" ON public.subscription_payments FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

-- subscriptions
DROP POLICY IF EXISTS "Members can view their org subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Members can view their org subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

-- conversations (via contact)
DROP POLICY IF EXISTS "Members can view their org conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can insert their org conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can update their org conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can delete their org conversations" ON public.conversations;
CREATE POLICY "Members can view their org conversations" ON public.conversations FOR SELECT TO authenticated USING (contact_id IN (SELECT id FROM contacts WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Members can insert their org conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (contact_id IN (SELECT id FROM contacts WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Members can update their org conversations" ON public.conversations FOR UPDATE TO authenticated USING (contact_id IN (SELECT id FROM contacts WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Members can delete their org conversations" ON public.conversations FOR DELETE TO authenticated USING (contact_id IN (SELECT id FROM contacts WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));

-- voice_calls (via contact)
DROP POLICY IF EXISTS "Members can view their org voice calls" ON public.voice_calls;
DROP POLICY IF EXISTS "Members can insert their org voice calls" ON public.voice_calls;
DROP POLICY IF EXISTS "Members can update their org voice calls" ON public.voice_calls;
CREATE POLICY "Members can view their org voice calls" ON public.voice_calls FOR SELECT TO authenticated USING (contact_id IN (SELECT id FROM contacts WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Members can insert their org voice calls" ON public.voice_calls FOR INSERT TO authenticated WITH CHECK (contact_id IN (SELECT id FROM contacts WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Members can update their org voice calls" ON public.voice_calls FOR UPDATE TO authenticated USING (contact_id IN (SELECT id FROM contacts WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));

-- voice_campaign_contacts (via campaign)
DROP POLICY IF EXISTS "Members can view their org voice campaign contacts" ON public.voice_campaign_contacts;
DROP POLICY IF EXISTS "Members can insert their org voice campaign contacts" ON public.voice_campaign_contacts;
DROP POLICY IF EXISTS "Members can update their org voice campaign contacts" ON public.voice_campaign_contacts;
CREATE POLICY "Members can view their org voice campaign contacts" ON public.voice_campaign_contacts FOR SELECT TO authenticated USING (campaign_id IN (SELECT id FROM voice_campaigns WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Members can insert their org voice campaign contacts" ON public.voice_campaign_contacts FOR INSERT TO authenticated WITH CHECK (campaign_id IN (SELECT id FROM voice_campaigns WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Members can update their org voice campaign contacts" ON public.voice_campaign_contacts FOR UPDATE TO authenticated USING (campaign_id IN (SELECT id FROM voice_campaigns WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));

-- stages (via pipeline)
DROP POLICY IF EXISTS "Members can view their org stages" ON public.stages;
DROP POLICY IF EXISTS "Members can insert their org stages" ON public.stages;
DROP POLICY IF EXISTS "Members can update their org stages" ON public.stages;
DROP POLICY IF EXISTS "Members can delete their org stages" ON public.stages;
CREATE POLICY "Members can view their org stages" ON public.stages FOR SELECT TO authenticated USING (pipeline_id IN (SELECT id FROM pipelines WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Members can insert their org stages" ON public.stages FOR INSERT TO authenticated WITH CHECK (pipeline_id IN (SELECT id FROM pipelines WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Members can update their org stages" ON public.stages FOR UPDATE TO authenticated USING (pipeline_id IN (SELECT id FROM pipelines WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Members can delete their org stages" ON public.stages FOR DELETE TO authenticated USING (pipeline_id IN (SELECT id FROM pipelines WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));

-- 8. SPECIAL TABLES
DROP POLICY IF EXISTS "Members can view their organization" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can manage all members" ON public.organization_members;
CREATE POLICY "Members can view their organization" ON public.organization_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin_master());
CREATE POLICY "Admins can manage all members" ON public.organization_members FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

DROP POLICY IF EXISTS "Members can view their org storage usage" ON public.organization_storage_usage;
CREATE POLICY "Members can view their org storage usage" ON public.organization_storage_usage FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Owners can update their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Admins can manage all organizations" ON public.organizations;
CREATE POLICY "Members can view their organizations" ON public.organizations FOR SELECT TO authenticated USING (id IN (SELECT get_user_organization_ids(auth.uid())));
CREATE POLICY "Owners can update their organizations" ON public.organizations FOR UPDATE TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Admins can manage all organizations" ON public.organizations FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin_master());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Authenticated users can view active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admin master can manage coupons" ON public.coupons;
CREATE POLICY "Authenticated users can view active coupons" ON public.coupons FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

DROP POLICY IF EXISTS "Public can read public settings" ON public.saas_settings;
DROP POLICY IF EXISTS "Authenticated can read all settings" ON public.saas_settings;
DROP POLICY IF EXISTS "Admins can read all settings" ON public.saas_settings;
DROP POLICY IF EXISTS "Admins can manage all settings" ON public.saas_settings;
CREATE POLICY "Public can read public settings" ON public.saas_settings FOR SELECT USING (key IN ('landing_page', 'general', 'branding'));
CREATE POLICY "Admins can read all settings" ON public.saas_settings FOR SELECT TO authenticated USING (is_admin_master());
CREATE POLICY "Admins can manage all settings" ON public.saas_settings FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Admins can manage plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

DROP POLICY IF EXISTS "Anyone can view tutorial categories" ON public.tutorial_categories;
DROP POLICY IF EXISTS "Admins can manage tutorial categories" ON public.tutorial_categories;
DROP POLICY IF EXISTS "Authenticated can view tutorial categories" ON public.tutorial_categories;
CREATE POLICY "Authenticated can view tutorial categories" ON public.tutorial_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage tutorial categories" ON public.tutorial_categories FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());

DROP POLICY IF EXISTS "Authenticated users can view published tutorials" ON public.tutorials;
DROP POLICY IF EXISTS "Admins can manage all tutorials" ON public.tutorials;
CREATE POLICY "Authenticated users can view published tutorials" ON public.tutorials FOR SELECT TO authenticated USING (is_published = true OR is_admin_master());
CREATE POLICY "Admins can manage all tutorials" ON public.tutorials FOR ALL TO authenticated USING (is_admin_master()) WITH CHECK (is_admin_master());
