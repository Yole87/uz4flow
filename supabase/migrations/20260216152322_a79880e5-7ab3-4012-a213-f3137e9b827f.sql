
-- Add OAuth 2.0 columns to mcp_connections
ALTER TABLE public.mcp_connections
ADD COLUMN IF NOT EXISTS refresh_token text,
ADD COLUMN IF NOT EXISTS token_expiry timestamp with time zone,
ADD COLUMN IF NOT EXISTS scopes text;
