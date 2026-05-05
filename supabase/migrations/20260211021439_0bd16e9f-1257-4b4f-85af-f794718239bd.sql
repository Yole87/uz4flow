
-- Fix: Enable RLS and add policies for minor tables

-- 1. COUPONS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin master can manage coupons" ON public.coupons;
CREATE POLICY "Admin master can manage coupons"
  ON public.coupons FOR ALL
  USING (public.is_admin_master())
  WITH CHECK (public.is_admin_master());

DROP POLICY IF EXISTS "Authenticated users can view active coupons" ON public.coupons;
CREATE POLICY "Authenticated users can view active coupons"
  ON public.coupons FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- 2. COUPON_REDEMPTIONS
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view all redemptions" ON public.coupon_redemptions;
CREATE POLICY "Admin can view all redemptions"
  ON public.coupon_redemptions FOR SELECT
  USING (public.is_admin_master());

DROP POLICY IF EXISTS "Users can view own redemptions" ON public.coupon_redemptions;
CREATE POLICY "Users can view own redemptions"
  ON public.coupon_redemptions FOR SELECT
  USING (auth.uid() = user_id);

-- 3. RATE_LIMITS - internal only, service role access
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 4. PROSPECT_PROVIDERS - org-member scoped
ALTER TABLE public.prospect_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view their prospect providers" ON public.prospect_providers;
CREATE POLICY "Org members can view their prospect providers"
  ON public.prospect_providers FOR SELECT
  USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Org members can insert prospect providers" ON public.prospect_providers;
CREATE POLICY "Org members can insert prospect providers"
  ON public.prospect_providers FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Org members can update their prospect providers" ON public.prospect_providers;
CREATE POLICY "Org members can update their prospect providers"
  ON public.prospect_providers FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Org members can delete their prospect providers" ON public.prospect_providers;
CREATE POLICY "Org members can delete their prospect providers"
  ON public.prospect_providers FOR DELETE
  USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));
