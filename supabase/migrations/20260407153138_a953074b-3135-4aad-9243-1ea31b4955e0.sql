
-- =============================================
-- FEATURE 1: RLS HARDENING
-- =============================================

-- PART A: Drop redundant {public} policies that have {authenticated} equivalents
-- auto_reengagement_config
DROP POLICY IF EXISTS "Users can delete their own configs" ON auto_reengagement_config;
DROP POLICY IF EXISTS "Users can insert their own configs" ON auto_reengagement_config;
DROP POLICY IF EXISTS "Users can view their own configs" ON auto_reengagement_config;
DROP POLICY IF EXISTS "Users can update their own configs" ON auto_reengagement_config;

-- auto_reengagement_queue
DROP POLICY IF EXISTS "Users can delete their own queue items" ON auto_reengagement_queue;
DROP POLICY IF EXISTS "Users can insert their own queue items" ON auto_reengagement_queue;
DROP POLICY IF EXISTS "Users can view their own queue items" ON auto_reengagement_queue;
DROP POLICY IF EXISTS "Users can update their own queue items" ON auto_reengagement_queue;

-- connector_events
DROP POLICY IF EXISTS "Users can insert their own connector events" ON connector_events;
DROP POLICY IF EXISTS "Users can view their own connector events" ON connector_events;
DROP POLICY IF EXISTS "Users can update their own connector events" ON connector_events;

-- contact_attachments
DROP POLICY IF EXISTS "Users can delete their org attachments" ON contact_attachments;
DROP POLICY IF EXISTS "Users can insert their org attachments" ON contact_attachments;
DROP POLICY IF EXISTS "Users can view their org attachments" ON contact_attachments;

-- contact_notes
DROP POLICY IF EXISTS "Users can delete their own notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can insert their org contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can view their org contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON contact_notes;

-- contacts
DROP POLICY IF EXISTS "Users can delete their organization contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert their organization contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view their organization contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their organization contacts" ON contacts;

-- conversations
DROP POLICY IF EXISTS "Users can delete conversations of their contacts" ON conversations;
DROP POLICY IF EXISTS "Users can insert conversations for their contacts" ON conversations;
DROP POLICY IF EXISTS "Users can view conversations of their contacts" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations of their contacts" ON conversations;

-- coupon_redemptions (drop public duplicates)
DROP POLICY IF EXISTS "Users can insert their own redemptions" ON coupon_redemptions;
DROP POLICY IF EXISTS "Admin can view all redemptions" ON coupon_redemptions;
DROP POLICY IF EXISTS "Users can view own redemptions" ON coupon_redemptions;
DROP POLICY IF EXISTS "Users can view their organization redemptions" ON coupon_redemptions;

-- crm_openbot_config (drop public duplicates)
DROP POLICY IF EXISTS "Deny direct SELECT on crm_openbot_config" ON crm_openbot_config;
DROP POLICY IF EXISTS "Owners can delete their org config" ON crm_openbot_config;
DROP POLICY IF EXISTS "Owners can insert their org config" ON crm_openbot_config;
DROP POLICY IF EXISTS "Owners can update their org config" ON crm_openbot_config;

-- crm_webhook_events (INSERT, SELECT have auth dups)
DROP POLICY IF EXISTS "Users can insert their org events" ON crm_webhook_events;
DROP POLICY IF EXISTS "Users can view their org events" ON crm_webhook_events;

-- event_actions
DROP POLICY IF EXISTS "Users can insert their own event actions" ON event_actions;
DROP POLICY IF EXISTS "Users can view their own event actions" ON event_actions;
DROP POLICY IF EXISTS "Users can update their own event actions" ON event_actions;

-- events
DROP POLICY IF EXISTS "Users can insert their own events" ON events;
DROP POLICY IF EXISTS "Users can view their own events" ON events;
DROP POLICY IF EXISTS "Users can update their own events" ON events;

-- files
DROP POLICY IF EXISTS "Users can insert their own files" ON files;
DROP POLICY IF EXISTS "Users can view their own files" ON files;

-- flow_sessions
DROP POLICY IF EXISTS "Users can insert their own sessions" ON flow_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON flow_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON flow_sessions;

-- flow_steps
DROP POLICY IF EXISTS "Users can delete their own flow steps" ON flow_steps;
DROP POLICY IF EXISTS "Users can insert their own flow steps" ON flow_steps;
DROP POLICY IF EXISTS "Users can view their own flow steps" ON flow_steps;
DROP POLICY IF EXISTS "Users can update their own flow steps" ON flow_steps;

-- flow_webhooks
DROP POLICY IF EXISTS "Users can delete their own flow webhooks" ON flow_webhooks;
DROP POLICY IF EXISTS "Users can insert their own flow webhooks" ON flow_webhooks;
DROP POLICY IF EXISTS "Users can view their own flow webhooks" ON flow_webhooks;
DROP POLICY IF EXISTS "Users can update their own flow webhooks" ON flow_webhooks;

-- flows
DROP POLICY IF EXISTS "Users can delete their own flows" ON flows;
DROP POLICY IF EXISTS "Users can insert their own flows" ON flows;
DROP POLICY IF EXISTS "Users can view their own flows" ON flows;
DROP POLICY IF EXISTS "Users can update their own flows" ON flows;

-- message_templates
DROP POLICY IF EXISTS "Users can delete their own templates" ON message_templates;
DROP POLICY IF EXISTS "Users can insert their own templates" ON message_templates;
DROP POLICY IF EXISTS "Users can view their own templates" ON message_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON message_templates;

-- messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;

-- organizations (drop public duplicates, keep public INSERT for signup)
DROP POLICY IF EXISTS "Admin master can do everything on organizations" ON organizations;
DROP POLICY IF EXISTS "Members can view their organization" ON organizations;
DROP POLICY IF EXISTS "Owner can update their organization" ON organizations;

-- routing_rules
DROP POLICY IF EXISTS "Users can delete their own rules" ON routing_rules;
DROP POLICY IF EXISTS "Users can insert their own rules" ON routing_rules;
DROP POLICY IF EXISTS "Users can view their own rules" ON routing_rules;
DROP POLICY IF EXISTS "Users can update their own rules" ON routing_rules;

-- session_responses (INSERT, SELECT have auth dups)
DROP POLICY IF EXISTS "Users can insert their own session responses" ON session_responses;
DROP POLICY IF EXISTS "Users can view their own session responses" ON session_responses;

-- subscriptions
DROP POLICY IF EXISTS "Admin master can do everything on subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Members can view their subscription" ON subscriptions;

-- user_roles (drop public duplicate)
DROP POLICY IF EXISTS "Admin master can manage roles" ON user_roles;

-- webhook_connectors
DROP POLICY IF EXISTS "Users can delete their own connectors" ON webhook_connectors;
DROP POLICY IF EXISTS "Users can insert their own connectors" ON webhook_connectors;
DROP POLICY IF EXISTS "Users can view their own connectors" ON webhook_connectors;
DROP POLICY IF EXISTS "Users can update their own connectors" ON webhook_connectors;

-- instagram related (drop public dups where auth exists)
DROP POLICY IF EXISTS "Members can insert their org instagram leads" ON instagram_leads;
DROP POLICY IF EXISTS "Members can view their org instagram leads" ON instagram_leads;
DROP POLICY IF EXISTS "Members can update their org instagram leads" ON instagram_leads;
DROP POLICY IF EXISTS "Members can insert their org instagram sessions" ON instagram_sessions;
DROP POLICY IF EXISTS "Members can view their org instagram sessions" ON instagram_sessions;
DROP POLICY IF EXISTS "Members can update their org instagram sessions" ON instagram_sessions;

-- prospect_results
DROP POLICY IF EXISTS "Users can view their organization results" ON prospect_results;
DROP POLICY IF EXISTS "Users can insert their organization results" ON prospect_results;

-- prospect_searches  
DROP POLICY IF EXISTS "Users can view their organization searches" ON prospect_searches;
DROP POLICY IF EXISTS "Users can insert their organization searches" ON prospect_searches;
DROP POLICY IF EXISTS "Users can update their organization searches" ON prospect_searches;

-- visual_scrape_sessions
DROP POLICY IF EXISTS "Users can view their organization sessions" ON visual_scrape_sessions;
DROP POLICY IF EXISTS "Users can insert their organization sessions" ON visual_scrape_sessions;
DROP POLICY IF EXISTS "Users can update their organization sessions" ON visual_scrape_sessions;

-- voice_calls
DROP POLICY IF EXISTS "Users can view their org voice calls" ON voice_calls;
DROP POLICY IF EXISTS "Users can insert their org voice calls" ON voice_calls;
DROP POLICY IF EXISTS "Users can update their org voice calls" ON voice_calls;

-- voice_campaign_contacts
DROP POLICY IF EXISTS "Users can view their org campaign contacts" ON voice_campaign_contacts;
DROP POLICY IF EXISTS "Users can insert their org campaign contacts" ON voice_campaign_contacts;
DROP POLICY IF EXISTS "Users can update their org campaign contacts" ON voice_campaign_contacts;

-- PART B: Migrate NO_AUTH_DUP public policies to authenticated

-- coupon_redemptions: admin ALL
DROP POLICY IF EXISTS "Admin master can manage redemptions" ON coupon_redemptions;
CREATE POLICY "Admin master can manage redemptions" ON coupon_redemptions
  FOR ALL TO authenticated
  USING (is_admin_master())
  WITH CHECK (is_admin_master());

-- crm_webhook_events: DELETE
DROP POLICY IF EXISTS "Users can delete their org events" ON crm_webhook_events;
CREATE POLICY "Members can delete their org events" ON crm_webhook_events
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- instagram_leads: DELETE
DROP POLICY IF EXISTS "Members can delete their org instagram leads" ON instagram_leads;
CREATE POLICY "Members can delete their org instagram leads" ON instagram_leads
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- instagram_sessions: DELETE
DROP POLICY IF EXISTS "Members can delete their org instagram sessions" ON instagram_sessions;
CREATE POLICY "Members can delete their org instagram sessions" ON instagram_sessions
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- organizations: INSERT for signup (must remain accessible during checkout)
DROP POLICY IF EXISTS "Users can create their own organizations" ON organizations;
CREATE POLICY "Users can create their own organizations" ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- prospect_results: DELETE
DROP POLICY IF EXISTS "Users can delete their organization results" ON prospect_results;
CREATE POLICY "Members can delete their org results" ON prospect_results
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- prospect_searches: DELETE
DROP POLICY IF EXISTS "Users can delete their organization searches" ON prospect_searches;
CREATE POLICY "Members can delete their org searches" ON prospect_searches
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- session_responses: DELETE
DROP POLICY IF EXISTS "Users can delete their own session responses" ON session_responses;
CREATE POLICY "Members can delete their own session responses" ON session_responses
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM flow_sessions
      WHERE flow_sessions.id = session_responses.session_id
      AND flow_sessions.user_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin_master')
  );

-- subscription_plans: cleanup duplicates, keep ONE public read for landing page
DROP POLICY IF EXISTS "Anyone can view active plans" ON subscription_plans;
DROP POLICY IF EXISTS "Authenticated users can view active plans" ON subscription_plans;
-- Keep "Anyone can view active public plans" on public (needed for unauthenticated landing page)

-- trial_records: ALL
DROP POLICY IF EXISTS "Admin can manage trial records" ON trial_records;
CREATE POLICY "Admin can manage trial records" ON trial_records
  FOR ALL TO authenticated
  USING (is_admin_master())
  WITH CHECK (is_admin_master());

-- usage_logs: ALL
DROP POLICY IF EXISTS "Admin master can do everything on usage logs" ON usage_logs;
CREATE POLICY "Admin master can manage usage logs" ON usage_logs
  FOR ALL TO authenticated
  USING (is_admin_master())
  WITH CHECK (is_admin_master());

-- usage_summary: ALL
DROP POLICY IF EXISTS "Admin master can do everything on usage summary" ON usage_summary;
CREATE POLICY "Admin master can manage usage summary" ON usage_summary
  FOR ALL TO authenticated
  USING (is_admin_master())
  WITH CHECK (is_admin_master());

-- visual_scrape_sessions: DELETE
DROP POLICY IF EXISTS "Users can delete their organization sessions" ON visual_scrape_sessions;
CREATE POLICY "Members can delete their org sessions" ON visual_scrape_sessions
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- voice_calls: DELETE
DROP POLICY IF EXISTS "Users can delete their org voice calls" ON voice_calls;
CREATE POLICY "Members can delete their org voice calls" ON voice_calls
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- voice_campaign_contacts: DELETE
DROP POLICY IF EXISTS "Users can delete their org campaign contacts" ON voice_campaign_contacts;
CREATE POLICY "Members can delete their org campaign contacts" ON voice_campaign_contacts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM voice_campaigns vc
      WHERE vc.id = voice_campaign_contacts.campaign_id
      AND vc.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
    )
  );

-- PART C: Add WITH CHECK to profiles UPDATE
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- PART D: Add WITH CHECK to crm_openbot_config UPDATE (protect organization_id)
DROP POLICY IF EXISTS "Members can update their org CRM config" ON crm_openbot_config;
CREATE POLICY "Members can update their org CRM config" ON crm_openbot_config
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())))
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- PART E: Ensure organizations UPDATE has WITH CHECK (already exists from prior migration, verify)
-- The existing "Owners can update their organizations" on {authenticated} needs WITH CHECK
DROP POLICY IF EXISTS "Owners can update their organizations" ON organizations;
CREATE POLICY "Owners can update their organizations" ON organizations
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (
    owner_user_id = auth.uid()
    AND NOT (is_active IS DISTINCT FROM (SELECT o.is_active FROM organizations o WHERE o.id = organizations.id))
    AND NOT (blocked_at IS DISTINCT FROM (SELECT o.blocked_at FROM organizations o WHERE o.id = organizations.id))
    AND NOT (block_reason IS DISTINCT FROM (SELECT o.block_reason FROM organizations o WHERE o.id = organizations.id))
  );
