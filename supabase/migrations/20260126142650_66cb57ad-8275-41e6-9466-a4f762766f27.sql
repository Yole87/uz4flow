-- Add notes field to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create discount_type enum
DO $$ BEGIN
  CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed_amount');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create applies_to enum
DO $$ BEGIN
  CREATE TYPE public.applies_to AS ENUM ('all_plans', 'specific_plans');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create coupons table
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL,
  applies_to applies_to NOT NULL DEFAULT 'all_plans',
  applicable_plan_ids UUID[] DEFAULT '{}',
  min_plan_price NUMERIC DEFAULT 0,
  max_uses_total INTEGER,
  max_uses_per_user INTEGER DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_first_purchase BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create coupon_redemptions table
CREATE TABLE public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  discount_applied NUMERIC NOT NULL,
  original_price NUMERIC NOT NULL,
  final_price NUMERIC NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Enable RLS on coupon_redemptions
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for coupons - Admin master can manage all
CREATE POLICY "Admin master can manage coupons" ON public.coupons
FOR ALL USING (is_admin_master()) WITH CHECK (is_admin_master());

-- Users can view active coupons (for validation during checkout)
CREATE POLICY "Anyone can view active coupons" ON public.coupons
FOR SELECT USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (expires_at IS NULL OR expires_at > now()));

-- RLS policies for coupon_redemptions
CREATE POLICY "Admin master can manage redemptions" ON public.coupon_redemptions
FOR ALL USING (is_admin_master()) WITH CHECK (is_admin_master());

CREATE POLICY "Users can view their organization redemptions" ON public.coupon_redemptions
FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their own redemptions" ON public.coupon_redemptions
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create trigger for updated_at on coupons
CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_coupons_code ON public.coupons(code);
CREATE INDEX idx_coupons_is_active ON public.coupons(is_active);
CREATE INDEX idx_coupon_redemptions_coupon_id ON public.coupon_redemptions(coupon_id);
CREATE INDEX idx_coupon_redemptions_organization_id ON public.coupon_redemptions(organization_id);