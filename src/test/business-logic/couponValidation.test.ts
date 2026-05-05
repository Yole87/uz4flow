/**
 * Business Logic Tests: Coupon Validation
 *
 * Tests the discount calculation logic from validate-coupon edge function.
 */
import { describe, it, expect } from "vitest";

interface CouponData {
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  is_active: boolean;
  applies_to: "all_plans" | "specific_plans";
  applicable_plan_ids: string[] | null;
  max_uses_total: number | null;
  current_uses: number;
  min_plan_price: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_first_purchase: boolean;
}

function calculateDiscount(coupon: CouponData, planPrice: number) {
  let discountAmount: number;
  if (coupon.discount_type === "percentage") {
    discountAmount = (planPrice * coupon.discount_value) / 100;
  } else {
    discountAmount = coupon.discount_value;
  }
  discountAmount = Math.min(discountAmount, planPrice);
  const finalPrice = Math.max(planPrice - discountAmount, 0);
  return { discountAmount, finalPrice };
}

function isCouponValid(coupon: CouponData, planId: string, planPrice: number, now = new Date()): { valid: boolean; error?: string } {
  if (!coupon.is_active) return { valid: false, error: "Cupom inativo" };
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return { valid: false, error: "Cupom ainda não está válido" };
  if (coupon.expires_at && new Date(coupon.expires_at) < now) return { valid: false, error: "Cupom expirado" };
  if (coupon.max_uses_total !== null && coupon.current_uses >= coupon.max_uses_total) return { valid: false, error: "Cupom atingiu limite de uso" };
  if (coupon.applies_to === "specific_plans") {
    const applicable = coupon.applicable_plan_ids || [];
    if (!applicable.includes(planId)) return { valid: false, error: "Cupom não aplicável a este plano" };
  }
  if (coupon.min_plan_price !== null && planPrice < coupon.min_plan_price) return { valid: false, error: "Plano abaixo do preço mínimo" };
  return { valid: true };
}

// ──── Discount Calculations ────

describe("Coupon Discount Calculations", () => {
  it("percentage discount", () => {
    const result = calculateDiscount({ discount_type: "percentage", discount_value: 20 } as CouponData, 100);
    expect(result.discountAmount).toBe(20);
    expect(result.finalPrice).toBe(80);
  });

  it("fixed amount discount", () => {
    const result = calculateDiscount({ discount_type: "fixed_amount", discount_value: 30 } as CouponData, 100);
    expect(result.discountAmount).toBe(30);
    expect(result.finalPrice).toBe(70);
  });

  it("discount cannot exceed price", () => {
    const result = calculateDiscount({ discount_type: "fixed_amount", discount_value: 150 } as CouponData, 100);
    expect(result.discountAmount).toBe(100);
    expect(result.finalPrice).toBe(0);
  });

  it("100% percentage discount → free", () => {
    const result = calculateDiscount({ discount_type: "percentage", discount_value: 100 } as CouponData, 89.90);
    expect(result.discountAmount).toBeCloseTo(89.90);
    expect(result.finalPrice).toBeCloseTo(0);
  });
});

// ──── Validation Rules ────

describe("Coupon Validation Rules", () => {
  const baseCoupon: CouponData = {
    discount_type: "percentage",
    discount_value: 10,
    is_active: true,
    applies_to: "all_plans",
    applicable_plan_ids: null,
    max_uses_total: null,
    current_uses: 0,
    min_plan_price: null,
    starts_at: null,
    expires_at: null,
    is_first_purchase: false,
  };

  it("inactive coupon → invalid", () => {
    const result = isCouponValid({ ...baseCoupon, is_active: false }, "plan-1", 100);
    expect(result.valid).toBe(false);
  });

  it("expired coupon → invalid", () => {
    const result = isCouponValid({ ...baseCoupon, expires_at: "2020-01-01T00:00:00Z" }, "plan-1", 100);
    expect(result.valid).toBe(false);
  });

  it("future start date → invalid", () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = isCouponValid({ ...baseCoupon, starts_at: futureDate }, "plan-1", 100);
    expect(result.valid).toBe(false);
  });

  it("max uses reached → invalid", () => {
    const result = isCouponValid({ ...baseCoupon, max_uses_total: 10, current_uses: 10 }, "plan-1", 100);
    expect(result.valid).toBe(false);
  });

  it("specific plans, wrong plan → invalid", () => {
    const result = isCouponValid(
      { ...baseCoupon, applies_to: "specific_plans", applicable_plan_ids: ["plan-2", "plan-3"] },
      "plan-1", 100
    );
    expect(result.valid).toBe(false);
  });

  it("specific plans, correct plan → valid", () => {
    const result = isCouponValid(
      { ...baseCoupon, applies_to: "specific_plans", applicable_plan_ids: ["plan-1", "plan-2"] },
      "plan-1", 100
    );
    expect(result.valid).toBe(true);
  });

  it("min plan price not met → invalid", () => {
    const result = isCouponValid({ ...baseCoupon, min_plan_price: 50 }, "plan-1", 29.90);
    expect(result.valid).toBe(false);
  });

  it("all checks pass → valid", () => {
    const result = isCouponValid(baseCoupon, "plan-1", 100);
    expect(result.valid).toBe(true);
  });
});
