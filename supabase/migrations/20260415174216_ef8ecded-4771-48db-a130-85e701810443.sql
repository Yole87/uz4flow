-- Add account_id column to instagram_sessions
ALTER TABLE public.instagram_sessions
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.instagram_accounts(id) ON DELETE SET NULL;

-- Create index for session lookups scoped by account
CREATE INDEX IF NOT EXISTS idx_instagram_sessions_account_id
  ON public.instagram_sessions (organization_id, account_id, status, expires_at);