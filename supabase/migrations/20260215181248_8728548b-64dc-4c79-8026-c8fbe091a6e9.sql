
-- Add authentication columns to mcp_server_configs
ALTER TABLE public.mcp_server_configs
  ADD COLUMN auth_type text NOT NULL DEFAULT 'none',
  ADD COLUMN auth_token text,
  ADD COLUMN custom_headers jsonb;
