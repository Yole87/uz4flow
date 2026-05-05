
-- Add trial_days column to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN trial_days integer DEFAULT NULL;

-- Create trial_records table for anti-fraud
CREATE TABLE public.trial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  activated_at timestamptz NOT NULL DEFAULT now(),
  trial_end_at timestamptz NOT NULL,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index to prevent same email from using same trial twice
CREATE UNIQUE INDEX idx_trial_records_email_plan ON public.trial_records (email, plan_id);

-- Enable RLS
ALTER TABLE public.trial_records ENABLE ROW LEVEL SECURITY;

-- Only admin_master can read all trial records
CREATE POLICY "Admin can manage trial records"
ON public.trial_records
FOR ALL
USING (public.is_admin_master())
WITH CHECK (public.is_admin_master());

-- Users can check their own trial records (needed for anti-fraud check)
CREATE POLICY "Users can view their own trial records"
ON public.trial_records
FOR SELECT
USING (auth.uid() = user_id);

-- Set trial_days = 7 for existing free plan
UPDATE public.subscription_plans SET trial_days = 7 WHERE is_free = true;
