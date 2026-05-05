-- Create table for CRM webhook event logs
CREATE TABLE crm_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('success', 'error', 'ignored', 'duplicate', 'pending')),
  instance_id TEXT,
  phone TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast organization queries with descending order
CREATE INDEX idx_crm_webhook_events_org_created ON crm_webhook_events(organization_id, created_at DESC);

-- Index for status filtering
CREATE INDEX idx_crm_webhook_events_status ON crm_webhook_events(status);

-- Enable Row Level Security
ALTER TABLE crm_webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their organization events
CREATE POLICY "Users can view their org events"
  ON crm_webhook_events FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- Policy: Allow service role to insert (edge functions)
CREATE POLICY "Service role can insert events"
  ON crm_webhook_events FOR INSERT
  WITH CHECK (true);

-- Policy: Users can delete old events from their org
CREATE POLICY "Users can delete their org events"
  ON crm_webhook_events FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE crm_webhook_events;