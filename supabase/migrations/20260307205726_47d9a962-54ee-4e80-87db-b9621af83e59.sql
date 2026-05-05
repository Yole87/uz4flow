-- Admin notifications table
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_master_select" ON public.admin_notifications
  FOR SELECT TO authenticated
  USING (public.is_admin_master());

CREATE POLICY "admin_master_update" ON public.admin_notifications
  FOR UPDATE TO authenticated
  USING (public.is_admin_master())
  WITH CHECK (public.is_admin_master());

CREATE INDEX idx_admin_notifications_read ON public.admin_notifications (read, created_at DESC);