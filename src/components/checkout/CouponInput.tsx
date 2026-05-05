import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Tag, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface AppliedCoupon {
  id: string;
  code: string;
  name: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  discountAmount: number;
  finalPrice: number;
}

interface CouponInputProps {
  planId: string;
  originalPrice: number;
  onCouponApplied: (coupon: AppliedCoupon | null) => void;
  appliedCoupon: AppliedCoupon | null;
  disabled?: boolean;
}

export function CouponInput({
  planId,
  originalPrice,
  onCouponApplied,
  appliedCoupon,
  disabled = false,
}: CouponInputProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateCoupon = async () => {
    if (!code.trim()) return;

    setLoading(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("validate-coupon", {
        body: {
          code: code.trim().toUpperCase(),
          planId,
        },
      });

      if (fnError) throw fnError;

      if (!data.valid) {
        setError(data.error || "Cupom inválido");
        return;
      }

      onCouponApplied({
        id: data.coupon.id,
        code: data.coupon.code,
        name: data.coupon.name,
        discount_type: data.coupon.discount_type,
        discount_value: data.coupon.discount_value,
        discountAmount: data.discountAmount,
        finalPrice: data.finalPrice,
      });
      setCode("");
    } catch (err) {
      console.error("Error validating coupon:", err);
      setError("Erro ao validar cupom");
    } finally {
      setLoading(false);
    }
  };

  const removeCoupon = () => {
    onCouponApplied(null);
    setError("");
  };

  if (appliedCoupon) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {appliedCoupon.code}
            </span>
            <span className="text-xs text-green-600 dark:text-green-400">
              {appliedCoupon.discount_type === "percentage"
                ? `${appliedCoupon.discount_value}% OFF`
                : `R$ ${appliedCoupon.discount_value.toFixed(2)} OFF`}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={removeCoupon}
            disabled={disabled}
            className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Código do cupom"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                validateCoupon();
              }
            }}
            disabled={loading || disabled}
            className="pl-9 uppercase"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={validateCoupon}
          disabled={loading || !code.trim() || disabled}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
