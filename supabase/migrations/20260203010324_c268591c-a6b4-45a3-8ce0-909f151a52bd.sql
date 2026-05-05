-- Create table for visual scrape sessions (G-Maps style scraping)
CREATE TABLE public.visual_scrape_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, stopped, failed
  total_found INTEGER NOT NULL DEFAULT 0,
  current_url TEXT,
  current_screenshot TEXT, -- base64 encoded screenshot
  current_phase TEXT DEFAULT 'initializing',
  progress_percent INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metrics JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.visual_scrape_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization sessions"
ON public.visual_scrape_sessions
FOR SELECT
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their organization sessions"
ON public.visual_scrape_sessions
FOR INSERT
WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can update their organization sessions"
ON public.visual_scrape_sessions
FOR UPDATE
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their organization sessions"
ON public.visual_scrape_sessions
FOR DELETE
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- Index for faster queries
CREATE INDEX idx_visual_scrape_sessions_org_status ON public.visual_scrape_sessions(organization_id, status);
CREATE INDEX idx_visual_scrape_sessions_created ON public.visual_scrape_sessions(created_at DESC);