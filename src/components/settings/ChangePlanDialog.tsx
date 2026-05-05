import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Sparkles, ExternalLink, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type BillingCycle = "monthly" | "quarterly" | "semiannual" | "yearly";

const cycleLabels: Record<BillingCycle, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  yearly: "Anual",
};

interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  price_quarterly: number | null;
  price_semiannual: number | null;
  price_yearly: number | null;
  is_free: boolean | null;
  limits: any;
}

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const isInIframe = (): boolean => {
  try { return window.self !== window.top; } catch { return true; }
};

export function ChangePlanDialog({ open, onOpenChange }: ChangePlanDialogProps) {
  const { plan: currentPlan, subscription, refetch } = useOrganizationSubscription();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("monthly");
  const [couponCode, setCouponCode] = useState("");
  const [processing, setProcessing] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["available-plans-self-service"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .eq("is_public", true)
        .order("price", { ascending: true });
      if (error) throw error;
      return data as PlanRow[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (currentPlan?.id) {
      setSelectedPlanId(currentPlan.id);
    }
    if ((subscription as any)?.billing_cycle) {
      setSelectedCycle((subscription as any).billing_cycle);
    }
  }, [currentPlan?.id, subscription, open]);

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId) ?? null;

  const getPriceFor = (plan: PlanRow, cycle: BillingCycle) => {
    if (cycle === "monthly") return plan.price;
    if (cycle === "quarterly") return plan.price_quarterly ?? plan.price * 3;
    if (cycle === "semiannual") return plan.price_semiannual ?? plan.price * 6;
    return plan.price_yearly ?? plan.price * 12;
  };

  const getDiscount = (plan: PlanRow, cycle: BillingCycle) => {
    if (cycle === "monthly" || plan.price <= 0) return 0;
    const months = cycle === "quarterly" ? 3 : cycle === "semiannual" ? 6 : 12;
    const total = getPriceFor(plan, cycle);
    const monthlyEquiv = total / months;
    return Math.round(((plan.price - monthlyEquiv) / plan.price) * 100);
  };

  const isCurrentPlanAndCycle = (planId: string) =>
    planId === currentPlan?.id && (subscription as any)?.billing_cycle === selectedCycle;

  const handleConfirm = async () => {
    if (!selectedPlan) return;

    if (isCurrentPlanAndCycle(selectedPlan.id)) {
      toast.info("Esse já é o seu plano e ciclo atuais");
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-subscription", {
        body: {
          action: "change-plan",
          newPlanId: selectedPlan.id,
          billingCycle: selectedCycle,
          couponCode: couponCode.trim() || null,
          backUrl: `${window.location.origin}/subscription/callback`,
        },
      });

      if (error) throw error;

      if (data?.free) {
        toast.success("Plano atualizado com sucesso!");
        await refetch();
        onOpenChange(false);
        return;
      }

      if (data?.initPoint) {
        if (isInIframe()) {
          window.open(data.initPoint, "_blank");
          toast.success("Checkout aberto em uma nova aba — finalize o pagamento por lá.");
        } else {
          window.location.href = data.initPoint;
        }
        onOpenChange(false);
        return;
      }

      throw new Error(data?.error || "Falha ao trocar de plano");
    } catch (err: any) {
      console.error("change-plan error:", err);
      toast.error(err?.message || "Erro ao trocar de plano");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto quantum-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Mudar de plano
          </DialogTitle>
          <DialogDescription>
            Escolha o plano e o ciclo ideais para sua operação. A troca é imediata após confirmação do pagamento.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Cycle toggle */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(cycleLabels) as BillingCycle[]).map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setSelectedCycle(cycle)}
                  className={cn(
                    "p-2.5 rounded-lg border text-sm transition-all",
                    selectedCycle === cycle
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="font-medium">{cycleLabels[cycle]}</div>
                </button>
              ))}
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plans?.map((plan) => {
                const cyclePrice = getPriceFor(plan, selectedCycle);
                const discount = getDiscount(plan, selectedCycle);
                const isSelected = selectedPlanId === plan.id;
                const isCurrent = plan.id === currentPlan?.id;

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={cn(
                      "text-left rounded-xl border p-4 transition-all relative quantum-glass",
                      isSelected
                        ? "border-primary ring-2 ring-primary/50 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]"
                        : "border-border/60 hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-base">{plan.name}</h3>
                        {plan.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plan.description}</p>
                        )}
                      </div>
                      {isCurrent && (
                        <Badge variant="secondary" className="shrink-0 text-xs">Atual</Badge>
                      )}
                    </div>

                    <div className="mt-3">
                      {plan.is_free ? (
                        <p className="text-2xl font-bold">Grátis</p>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold">R$ {cyclePrice.toFixed(2)}</span>
                          <span className="text-xs text-muted-foreground">/{cycleLabels[selectedCycle].toLowerCase()}</span>
                        </div>
                      )}
                      {discount > 0 && (
                        <Badge variant="default" className="mt-1 bg-success/15 text-success hover:bg-success/15 border-success/30">
                          Economize {discount}%
                        </Badge>
                      )}
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Coupon */}
            {selectedPlan && !selectedPlan.is_free && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Tag className="w-3.5 h-3.5" />
                  Cupom de desconto (opcional)
                </Label>
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Digite seu cupom"
                  className="uppercase"
                />
              </div>
            )}

            {/* Action */}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={processing || !selectedPlan || isCurrentPlanAndCycle(selectedPlan.id)}
                className="min-w-[180px]"
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando…</>
                ) : selectedPlan?.is_free ? (
                  "Ativar plano gratuito"
                ) : (
                  <>Ir para o pagamento <ExternalLink className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
