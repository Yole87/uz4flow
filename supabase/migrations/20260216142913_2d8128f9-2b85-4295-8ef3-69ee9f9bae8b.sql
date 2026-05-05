
-- Create mcp_connections table
CREATE TABLE public.mcp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mcp_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies (org-based, same pattern as mcp_server_configs)
CREATE POLICY "Members can view their org MCP connections"
  ON public.mcp_connections FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can insert their org MCP connections"
  ON public.mcp_connections FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can update their org MCP connections"
  ON public.mcp_connections FOR UPDATE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can delete their org MCP connections"
  ON public.mcp_connections FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- Trigger for updated_at
CREATE TRIGGER update_mcp_connections_updated_at
  BEFORE UPDATE ON public.mcp_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
