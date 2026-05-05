-- ============================================
-- Security Fix: Restrict Public Access to Sensitive Tables
-- ============================================

-- 1. Fix saas_settings: Replace public policy with authenticated-only
DROP POLICY IF EXISTS "Anyone can view saas settings" ON saas_settings;

CREATE POLICY "Authenticated users can view saas settings"
ON saas_settings FOR SELECT
TO authenticated
USING (true);

-- 2. Fix coupons: Replace public policy with authenticated users only
-- This ensures coupons can only be viewed during checkout by logged-in users
DROP POLICY IF EXISTS "Anyone can view active coupons" ON coupons;

CREATE POLICY "Authenticated users can view active coupons"
ON coupons FOR SELECT
TO authenticated
USING (
  is_active = true 
  AND (starts_at IS NULL OR starts_at <= now()) 
  AND (expires_at IS NULL OR expires_at > now())
);