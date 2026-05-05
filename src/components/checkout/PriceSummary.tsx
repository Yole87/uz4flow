import { AppliedCoupon } from "./CouponInput";

type BillingCycle = "monthly" | "quarterly" | "semiannual" | "yearly";

const cycleLabels: Record<BillingCycle, string> = {
  monthly: "mês",
  quarterly: "trimestre",
  semiannual: "semestre",
  yearly: "ano",
};

interface PriceSummaryProps {
  originalPrice: number;
  appliedCoupon: AppliedCoupon | null;
  billingCycle: string | null;
  isFree: boolean;
}

export function PriceSummary({
  originalPrice,
  appliedCoupon,
  billingCycle,
  isFree,
}: PriceSummaryProps) {
  if (isFree) {
    return (
      <div className="mt-4">
        <span className="text-3xl font-bold">Grátis</span>
      </div>
    );
  }

  const cycle = (billingCycle || "monthly") as BillingCycle;
  const cycleLabel = cycleLabels[cycle] || "mês";
  const finalPrice = appliedCoupon ? appliedCoupon.finalPrice : originalPrice;
  const hasDiscount = appliedCoupon && appliedCoupon.discountAmount > 0;

  return (
    <div className="mt-4 space-y-2">
      {hasDiscount ? (
        <>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal:</span>
            <span>R$ {originalPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
            <span>Desconto ({appliedCoupon.code}):</span>
            <span>-R$ {appliedCoupon.discountAmount.toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between items-baseline">
            <span className="font-medium">Total:</span>
            <div className="text-right">
              <span className="text-3xl font-bold">
                R$ {finalPrice.toFixed(2)}
              </span>
              <span className="text-muted-foreground">
                /{cycleLabel}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div>
          <span className="text-3xl font-bold">
            R$ {originalPrice.toFixed(2)}
          </span>
          <span className="text-muted-foreground">
            /{cycleLabel}
          </span>
        </div>
      )}
    </div>
  );
}
