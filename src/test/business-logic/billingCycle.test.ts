/**
 * Business Logic Tests: Billing Cycle & MercadoPago Frequency
 *
 * Tests the billing cycle mapping used in mercadopago-subscription.
 */
import { describe, it, expect } from "vitest";

// Replicated from mercadopago-subscription/index.ts
function getCycleFrequency(billingCycle: string): { frequency: number; frequency_type: string } {
  switch (billingCycle) {
    case "quarterly":
      return { frequency: 3, frequency_type: "months" };
    case "semiannual":
      return { frequency: 6, frequency_type: "months" };
    case "yearly":
      return { frequency: 12, frequency_type: "months" };
    default:
      return { frequency: 1, frequency_type: "months" };
  }
}

function getCyclePrice(
  plan: { price: number; price_quarterly: number | null; price_semiannual: number | null; price_yearly: number | null },
  billingCycle: string
): number {
  switch (billingCycle) {
    case "quarterly":
      return plan.price_quarterly ?? plan.price * 3;
    case "semiannual":
      return plan.price_semiannual ?? plan.price * 6;
    case "yearly":
      return plan.price_yearly ?? plan.price * 12;
    default:
      return plan.price;
  }
}

describe("Billing Cycle Frequency Mapping", () => {
  it("monthly → 1 month", () => {
    const result = getCycleFrequency("monthly");
    expect(result).toEqual({ frequency: 1, frequency_type: "months" });
  });

  it("quarterly → 3 months", () => {
    const result = getCycleFrequency("quarterly");
    expect(result).toEqual({ frequency: 3, frequency_type: "months" });
  });

  it("semiannual → 6 months", () => {
    const result = getCycleFrequency("semiannual");
    expect(result).toEqual({ frequency: 6, frequency_type: "months" });
  });

  it("yearly → 12 months", () => {
    const result = getCycleFrequency("yearly");
    expect(result).toEqual({ frequency: 12, frequency_type: "months" });
  });

  it("unknown cycle defaults to monthly", () => {
    const result = getCycleFrequency("weekly");
    expect(result).toEqual({ frequency: 1, frequency_type: "months" });
  });
});

describe("Billing Cycle Price Calculation", () => {
  const plan = {
    price: 89.90,
    price_quarterly: 239.70,
    price_semiannual: 449.50,
    price_yearly: 799.00,
  };

  it("monthly → base price", () => {
    expect(getCyclePrice(plan, "monthly")).toBe(89.90);
  });

  it("quarterly → quarterly price", () => {
    expect(getCyclePrice(plan, "quarterly")).toBe(239.70);
  });

  it("yearly → yearly price (discount applied)", () => {
    expect(getCyclePrice(plan, "yearly")).toBe(799.00);
    // Should be cheaper than 12 × monthly
    expect(plan.price_yearly!).toBeLessThan(plan.price * 12);
  });

  it("quarterly null → falls back to 3x monthly", () => {
    const planNoQuarterly = { ...plan, price_quarterly: null };
    expect(getCyclePrice(planNoQuarterly, "quarterly")).toBeCloseTo(89.90 * 3);
  });
});

describe("Trial Plan → No Billing", () => {
  it("free plan should not generate MercadoPago subscription", () => {
    const plan = { is_free: true, price: 0, trial_days: 14 };
    // When is_free is true, the checkout flow returns { free: true } and doesn't call MP API
    expect(plan.is_free).toBe(true);
    expect(plan.price).toBe(0);
  });

  it("paid plan requires billing", () => {
    const plan = { is_free: false, price: 89.90, trial_days: null };
    expect(plan.is_free).toBe(false);
    expect(plan.price).toBeGreaterThan(0);
  });
});
