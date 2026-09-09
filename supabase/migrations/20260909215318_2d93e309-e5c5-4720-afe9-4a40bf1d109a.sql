ALTER TABLE public.uz_form_steps
  ADD COLUMN IF NOT EXISTS is_exit_step BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exit_ending_type TEXT,
  ADD COLUMN IF NOT EXISTS exit_ending_message TEXT,
  ADD COLUMN IF NOT EXISTS exit_ending_whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS exit_ending_whatsapp_message TEXT,
  ADD COLUMN IF NOT EXISTS exit_purchase_products JSONB,
  ADD COLUMN IF NOT EXISTS exit_calendar_include_meet BOOLEAN NOT NULL DEFAULT false;