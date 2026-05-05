
-- Create table for MCP server configurations per organization
CREATE TABLE public.mcp_server_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mcp_server_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies using organization membership
CREATE POLICY "Members can view their org MCP configs"
  ON public.mcp_server_configs FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can insert their org MCP configs"
  ON public.mcp_server_configs FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can update their org MCP configs"
  ON public.mcp_server_configs FOR UPDATE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can delete their org MCP configs"
  ON public.mcp_server_configs FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- Trigger for updated_at
CREATE TRIGGER update_mcp_server_configs_updated_at
  BEFORE UPDATE ON public.mcp_server_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
