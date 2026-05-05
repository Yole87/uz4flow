ALTER TABLE public.admin_notification_logs
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS admin_notif_logs_read_idx
  ON public.admin_notification_logs (read_at) WHERE read_at IS NULL;