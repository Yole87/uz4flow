import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, X, HardDrive, Users, Contact, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_FEATURES } from "@/hooks/useOrganizationLimits";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { saveCheckoutIntent } from "@/lib/checkoutIntent";

type BillingCycle = "monthly" | "quarterly" | "semiannual" | "yearly";

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  price_quarterly: number | null;
  price_semiannual: number | null;
  price_yearly: number | null;
  billing_cycle: string;
  limits: { features: string[]; storage_limit_mb?: number; member_limit?: number; contact_limit?: number };
  is_free: boolean;
  is_popular: boolean;
  highlight_label: string | null;
  trial_days: number | null;
}

const cycleLabels: Record<BillingCycle, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  yearly: "Anual",
};

const cycleMonths: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

function getPriceForCycle(plan: Plan, cycle: BillingCycle): number | null {
  switch (cycle) {
    case "monthly": return plan.price;
    case "quarterly": return plan.price_quarterly;
    case "semiannual": return plan.price_semiannual;
    case "yearly": return plan.price_yearly;
  }
}

function getMonthlyEquivalent(plan: Plan, cycle: BillingCycle): number | null {
  const total = getPriceForCycle(plan, cycle);
  if (total == null) return null;
  return total / cycleMonths[cycle];
}

function getDiscount(plan: Plan, cycle: BillingCycle): number {
  if (cycle === "monthly" || plan.price === 0) return 0;
  const totalAtMonthly = plan.price * cycleMonths[cycle];
  const cyclePrice = getPriceForCycle(plan, cycle);
  if (!cyclePrice || totalAtMonthly === 0) return 0;
  return Math.round(((totalAtMonthly - cyclePrice) / totalAtMonthly) * 100);
}

function formatLimit(value: number | undefined, unit: string): string {
  if (value == null) return "—";
  if (value === -1) return "Ilimitado";
  if (unit === "MB") {
    if (value >= 1024) return `${(value / 1024).toFixed(0)} GB`;
    return `${value} MB`;
  }
  return value.toLocaleString("pt-BR");
}

// Build categories from ALL_FEATURES
const featureCategories = ALL_FEATURES.reduce((acc, f) => {
  if (!acc[f.category]) acc[f.category] = [];
  acc[f.category].push(f);
  return acc;
}, {} as Record<string, typeof ALL_FEATURES[number][]>);

export function LandingPricing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const navigate = useNavigate();

  const handlePlanClick = (planId: string) => {
    // Always persist intent so the user comes back to checkout after auth/email confirm
    saveCheckoutIntent(planId, billingCycle);
    if (user) {
      navigate(`/checkout/${planId}?cycle=${billingCycle}`);
    } else {
      navigate(`/?tab=signup&plan=${planId}&cycle=${billingCycle}`);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .eq("is_public", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setPlans((data || []).map(p => {
        const limits = p.limits as Record<string, unknown> ?? {};
        return {
          ...p,
          limits: {
            features: (limits.features as string[]) ?? [],
            storage_limit_mb: (limits.storage_limit_mb as number) ?? 500,
            member_limit: (limits.member_limit as number) ?? 1,
            contact_limit: (limits.contact_limit as number) ?? 500,
          },
        };
      }) as Plan[]);
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  };

  const availableCycles: BillingCycle[] = ["monthly"];
  if (plans.some(p => !p.is_free && p.price_quarterly)) availableCycles.push("quarterly");
  if (plans.some(p => !p.is_free && p.price_semiannual)) availableCycles.push("semiannual");
  if (plans.some(p => !p.is_free && p.price_yearly)) availableCycles.push("yearly");

  if (loading) {
    return (
      <section id="pricing" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-scanline">
            Planos para cada
            <span className="text-gradient-primary text-glow-pink"> momento</span>
          </h2>
          <p className="text-sm uppercase tracking-widest text-muted-foreground max-w-2xl mx-auto mb-8 font-terminal">
            Comece grátis e escale conforme seu negócio cresce. Sem surpresas, sem taxas escondidas.
          </p>

          {availableCycles.length > 1 && (
            <div className="inline-flex flex-wrap items-center justify-center gap-1 p-1 quantum-glass btn-laser-cut">
              {availableCycles.map((cycle) => {
                const maxDiscount = Math.max(...plans.filter(p => !p.is_free).map(p => getDiscount(p, cycle)));
                return (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={cn(
                      "px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 btn-laser-cut-sm",
                      billingCycle === cycle
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cycleLabels[cycle]}
                    {maxDiscount > 0 && (
                      <span className="text-xs bg-success/20 text-success px-2 py-0.5 font-terminal btn-laser-cut-sm">
                        -{maxDiscount}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto pt-5">
          {plans.map((plan) => {
            const isPopular = plan.is_popular;
            const cyclePrice = plan.is_free ? 0 : getPriceForCycle(plan, billingCycle);
            const monthlyEquivalent = plan.is_free ? 0 : getMonthlyEquivalent(plan, billingCycle);
            const discount = getDiscount(plan, billingCycle);
            const hasCyclePrice = plan.is_free || cyclePrice != null;
            const displayMonthly = hasCyclePrice ? (monthlyEquivalent ?? plan.price) : plan.price;
            const planFeatures = plan.limits.features ?? [];

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative quantum-glass rounded-lg p-6 flex flex-col transition-all duration-300",
                  plan.highlight_label && "pt-10",
                  isPopular
                    ? "neon-glow-pink md:scale-105 z-10"
                    : "hover:neon-glow-pink"
                )}
                style={isPopular ? {
                  borderImage: 'linear-gradient(135deg, hsl(180 100% 50% / 0.5), hsl(272 100% 50% / 0.5)) 1',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                } : undefined}
              >
                {plan.highlight_label && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="gradient-primary text-primary-foreground text-xs font-medium px-3 py-1 btn-laser-cut-sm flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {plan.highlight_label}
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <h3 className="text-base sm:text-lg font-bold text-foreground">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 font-terminal">{plan.description}</p>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className={cn(
                      "text-2xl sm:text-3xl font-bold font-terminal text-foreground",
                      isPopular && "text-glow-pink"
                    )}>
                      {plan.is_free ? "Grátis" : formatPrice(displayMonthly)}
                    </span>
                    {!plan.is_free && <span className="text-muted-foreground font-terminal text-xs">/mês</span>}
                  </div>
                  {plan.is_free && plan.trial_days ? (
                    <p className="text-xs text-primary font-medium mt-1 font-terminal">
                      Teste grátis por {plan.trial_days} dias
                    </p>
                  ) : !plan.is_free && billingCycle !== "monthly" && cyclePrice ? (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-muted-foreground font-terminal">
                        {formatPrice(cyclePrice)} cobrado {cycleLabels[billingCycle].toLowerCase()}mente
                      </p>
                      {discount > 0 && (
                        <p className="text-xs text-success font-medium font-terminal">
                          Economia de {discount}% vs mensal
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Quantitative limits badges */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <div className="flex items-center gap-1 text-xs font-terminal text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                    <HardDrive className="w-3 h-3" />
                    {formatLimit(plan.limits.storage_limit_mb, "MB")}
                  </div>
                  <div className="flex items-center gap-1 text-xs font-terminal text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                    <Users className="w-3 h-3" />
                    {formatLimit(plan.limits.member_limit, "")} {plan.limits.member_limit === 1 ? "membro" : "membros"}
                  </div>
                  <div className="flex items-center gap-1 text-xs font-terminal text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                    <Contact className="w-3 h-3" />
                    {formatLimit(plan.limits.contact_limit, "")} contatos
                  </div>
                </div>

                <Button
                  type="button"
                  className={cn("w-full mb-5 btn-laser-cut", isPopular ? "gradient-primary border-0" : "")}
                  variant={isPopular ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePlanClick(plan.id)}
                >
                  {plan.is_free ? (plan.trial_days ? "Iniciar Teste Grátis" : "Começar Grátis") : "Assinar Agora"}
                </Button>

                {/* Features compact list */}
                <div className="space-y-1.5 flex-1 text-xs">
                  {planFeatures.map(fKey => {
                    const feat = ALL_FEATURES.find(f => f.key === fKey);
                    if (!feat) return null;
                    return (
                      <div key={fKey} className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-success shrink-0" />
                        <span className="text-muted-foreground font-terminal">{feat.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Comparison Table — Desktop */}
        {plans.length > 0 && (
          <div className="mt-16 max-w-6xl mx-auto">
            <h3 className="text-xl font-bold text-foreground text-center mb-8 font-terminal">
              Comparação detalhada
            </h3>

            {/* Desktop table */}
            <div className="hidden lg:block quantum-glass rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 font-terminal text-muted-foreground w-[280px]">Recurso</th>
                    {plans.map(p => (
                      <th key={p.id} className={cn("p-4 text-center font-terminal", p.is_popular && "text-primary")}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Quantitative limits section */}
                  <tr className="border-b border-border/30 bg-muted/20">
                    <td colSpan={plans.length + 1} className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground font-terminal">
                      Limites
                    </td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="p-3 pl-6 text-muted-foreground font-terminal flex items-center gap-2">
                      <HardDrive className="w-3.5 h-3.5" /> Armazenamento
                    </td>
                    {plans.map(p => (
                      <td key={p.id} className="p-3 text-center font-terminal text-foreground">
                        {formatLimit(p.limits.storage_limit_mb, "MB")}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="p-3 pl-6 text-muted-foreground font-terminal flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" /> Membros da equipe
                    </td>
                    {plans.map(p => (
                      <td key={p.id} className="p-3 text-center font-terminal text-foreground">
                        {formatLimit(p.limits.member_limit, "")}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="p-3 pl-6 text-muted-foreground font-terminal flex items-center gap-2">
                      <Contact className="w-3.5 h-3.5" /> Contatos
                    </td>
                    {plans.map(p => (
                      <td key={p.id} className="p-3 text-center font-terminal text-foreground">
                        {formatLimit(p.limits.contact_limit, "")}
                      </td>
                    ))}
                  </tr>

                  {/* Feature sections */}
                  {Object.entries(featureCategories).map(([category, features]) => (
                    <React.Fragment key={`cat-${category}`}>
                      <tr className="border-b border-border/30 bg-muted/20">
                        <td colSpan={plans.length + 1} className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground font-terminal">
                          {category}
                        </td>
                      </tr>
                      {features.map(feat => (
                        <tr key={feat.key} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                          <td className="p-3 pl-6 text-muted-foreground font-terminal">{feat.label}</td>
                          {plans.map(p => {
                            const included = p.limits.features.includes(feat.key);
                            return (
                              <td key={p.id} className="p-3 text-center">
                                {included ? (
                                  <Check className="w-4 h-4 text-success mx-auto" />
                                ) : (
                                  <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: collapsible per plan */}
            <div className="lg:hidden space-y-3">
              {plans.map(plan => (
                <Collapsible key={plan.id}>
                  <CollapsibleTrigger className={cn(
                    "w-full quantum-glass rounded-lg p-4 flex items-center justify-between",
                    plan.is_popular && "border border-primary/30"
                  )}>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">{plan.name}</span>
                      <span className="text-xs text-muted-foreground font-terminal">
                        {plan.is_free ? "Grátis" : `${formatPrice(plan.price)}/mês`}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="quantum-glass rounded-b-lg px-4 pb-4 space-y-3 mt-1">
                    {/* Limits */}
                    <div className="space-y-1.5 pt-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-terminal">Limites</p>
                      <div className="grid grid-cols-3 gap-2 text-xs font-terminal">
                        <div className="text-center p-2 bg-muted/30 rounded">
                          <HardDrive className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                          <span className="text-foreground">{formatLimit(plan.limits.storage_limit_mb, "MB")}</span>
                        </div>
                        <div className="text-center p-2 bg-muted/30 rounded">
                          <Users className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                          <span className="text-foreground">{formatLimit(plan.limits.member_limit, "")}</span>
                        </div>
                        <div className="text-center p-2 bg-muted/30 rounded">
                          <Contact className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                          <span className="text-foreground">{formatLimit(plan.limits.contact_limit, "")}</span>
                        </div>
                      </div>
                    </div>
                    {/* Features */}
                    {Object.entries(featureCategories).map(([category, features]) => (
                      <div key={category} className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-terminal">{category}</p>
                        {features.map(feat => {
                          const included = plan.limits.features.includes(feat.key);
                          return (
                            <div key={feat.key} className={cn("flex items-center gap-2 py-0.5", !included && "opacity-40")}>
                              {included ? (
                                <Check className="w-3 h-3 text-success shrink-0" />
                              ) : (
                                <X className="w-3 h-3 text-muted-foreground shrink-0" />
                              )}
                              <span className={cn("text-xs font-terminal", included ? "text-muted-foreground" : "text-muted-foreground line-through")}>
                                {feat.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      className="w-full btn-laser-cut mt-2"
                      variant={plan.is_popular ? "default" : "outline"}
                      onClick={() => handlePlanClick(plan.id)}
                    >
                      {plan.is_free ? "Começar Grátis" : "Assinar Agora"}
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        )}

        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4 font-terminal text-sm max-w-2xl mx-auto">
            Limites de armazenamento garantem estabilidade do serviço.
            <br className="hidden sm:block" />
            Precisa de mais? Fale com a gente.
          </p>
          <Button asChild variant="outline" size="lg" className="btn-laser-cut">
            <a href="mailto:suporte@openflow.studio">Fale com a gente</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
