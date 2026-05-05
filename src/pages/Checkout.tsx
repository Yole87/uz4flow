import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, CreditCard, Building2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CouponInput, AppliedCoupon } from "@/components/checkout/CouponInput";
import { PriceSummary } from "@/components/checkout/PriceSummary";

// Detect if running inside an iframe
const isInIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    // If access error, we're in a cross-origin iframe
    return true;
  }
};

type BillingCycle = "monthly" | "quarterly" | "semiannual" | "yearly";

const cycleLabels: Record<BillingCycle, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  yearly: "Anual",
};

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  price_quarterly: number | null;
  price_semiannual: number | null;
  price_yearly: number | null;
  billing_cycle: string | null;
  is_free: boolean | null;
  mp_plan_id: string | null;
}

interface Organization {
  id: string;
  name: string;
}

interface CheckoutState {
  opened: boolean;
  initPoint: string | null;
}

export default function Checkout() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const isProcessingRef = useRef(false);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [newOrgName, setNewOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ opened: false, initPoint: null });
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("monthly");

  useEffect(() => {
    fetchPlan();
    // Read cycle from URL params
    const params = new URLSearchParams(window.location.search);
    const cycle = params.get("cycle") as BillingCycle;
    if (cycle && ["monthly", "quarterly", "semiannual", "yearly"].includes(cycle)) {
      setSelectedCycle(cycle);
    }
  }, [planId]);

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    }
  }, [user]);

  const fetchPlan = async () => {
    if (!planId) return;

    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .eq("is_public", true)
      .single();

    if (error) {
      toast({
        title: "Erro",
        description: "Plano não encontrado",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setPlan(data);
    setLoading(false);
  };

  const fetchOrganizations = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(id, name)")
      .eq("user_id", user.id);

    if (data && data.length > 0) {
      const orgs = data
        .map((m) => m.organizations)
        .filter((o): o is Organization => o !== null);
      setOrganizations(orgs);
      if (orgs.length > 0) {
        setSelectedOrgId(orgs[0].id);
      }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setProcessing(true);

    try {
      if (authMode === "login") {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Você já pode continuar com a assinatura.",
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      setAuthError(error.message || "Erro ao autenticar");
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (!user || !plan) return;

    // Prevent double submission
    if (isProcessingRef.current) {
      console.log("Already processing, ignoring click");
      return;
    }
    
    isProcessingRef.current = true;
    setProcessing(true);

    try {
      // Send org creation/selection data to backend
      const orgId = selectedOrgId || undefined;
      const orgName = !selectedOrgId ? newOrgName.trim() : undefined;

      if (!orgId && !orgName) {
        toast({
          title: "Erro",
          description: "Selecione ou crie uma organização",
          variant: "destructive",
        });
        setProcessing(false);
        isProcessingRef.current = false;
        return;
      }

      // Call edge function — org creation + subscription handled server-side
      const { data, error } = await supabase.functions.invoke("mercadopago-subscription", {
        body: {
          action: "create-subscription",
          organizationId: orgId,
          orgName,
          planId: plan.id,
          billingCycle: selectedCycle,
          couponCode: appliedCoupon?.code || null,
          backUrl: `${window.location.origin}/subscription/callback`,
        },
      });

      if (error) throw error;

      if (data.free) {
        toast({
          title: "Sucesso!",
          description: "Plano gratuito ativado com sucesso.",
        });
        navigate("/dashboard");
        return;
      }

      if (data.initPoint) {
        // Check if running in iframe (like Lovable preview)
        if (isInIframe()) {
          // Open in new tab to avoid iframe security restrictions
          window.open(data.initPoint, '_blank');
          setCheckoutState({ opened: true, initPoint: data.initPoint });
          toast({
            title: "Checkout aberto",
            description: "O pagamento foi aberto em uma nova aba. Se não abriu, verifique se o bloqueador de pop-ups está ativado.",
          });
        } else {
          // Redirect normally when not in iframe
          window.location.href = data.initPoint;
        }
      } else {
        throw new Error("Falha ao obter link de pagamento");
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Checkout error:", error);
      toast({
        title: "Erro no checkout",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      isProcessingRef.current = false;
    }
  };

  // Show post-checkout instructions when opened in new tab
  if (checkoutState.opened) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <ExternalLink className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Complete seu pagamento</CardTitle>
            <CardDescription>
              O checkout do Mercado Pago foi aberto em uma nova aba
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
              <p className="text-muted-foreground">
                Após finalizar o pagamento, você será redirecionado automaticamente para a área logada.
              </p>
              <p className="text-muted-foreground">
                Se a nova aba não abriu, clique no botão abaixo.
              </p>
            </div>
            
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => window.open(checkoutState.initPoint!, '_blank')}
                variant="outline"
                className="w-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir checkout novamente
              </Button>
              
              <Button
                onClick={() => navigate("/subscription/callback")}
                className="w-full"
              >
                Já finalizei o pagamento
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Plano não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Finalizar Assinatura</h1>
          <p className="text-muted-foreground mt-2">
            Complete os passos abaixo para ativar seu plano
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Plan Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Resumo do Plano
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Billing Cycle Selector */}
              {!plan.is_free && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Ciclo de Cobrança</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["monthly", "quarterly", "semiannual", "yearly"] as BillingCycle[]).map((cycle) => {
                      const prices: Record<BillingCycle, number | null> = {
                        monthly: plan.price,
                        quarterly: plan.price_quarterly,
                        semiannual: plan.price_semiannual,
                        yearly: plan.price_yearly,
                      };
                      const cyclePrice = prices[cycle];
                      if (cyclePrice == null) return null;
                      const monthlyEquiv = cyclePrice / (cycle === "monthly" ? 1 : cycle === "quarterly" ? 3 : cycle === "semiannual" ? 6 : 12);
                      const discount = cycle !== "monthly" && plan.price > 0
                        ? Math.round(((plan.price - monthlyEquiv) / plan.price) * 100)
                        : 0;
                      return (
                        <button
                          key={cycle}
                          type="button"
                          onClick={() => { setSelectedCycle(cycle); setAppliedCoupon(null); }}
                          className={cn(
                            "p-3 rounded-lg border text-left transition-all text-sm",
                            selectedCycle === cycle
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/30"
                          )}
                        >
                          <div className="font-medium">{cycleLabels[cycle]}</div>
                          <div className="text-muted-foreground text-xs">
                            R$ {cyclePrice.toFixed(2)}
                            {discount > 0 && (
                              <span className="ml-1 text-success font-medium">(-{discount}%)</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-4 bg-muted rounded-lg">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                )}
                <PriceSummary
                  originalPrice={(() => {
                    const prices: Record<BillingCycle, number | null> = {
                      monthly: plan.price,
                      quarterly: plan.price_quarterly,
                      semiannual: plan.price_semiannual,
                      yearly: plan.price_yearly,
                    };
                    return prices[selectedCycle] ?? plan.price;
                  })()}
                  appliedCoupon={appliedCoupon}
                  billingCycle={selectedCycle}
                  isFree={plan.is_free || false}
                />
              </div>

              {/* Coupon Input - only for paid plans */}
              {!plan.is_free && (
                <CouponInput
                  planId={plan.id}
                  originalPrice={plan.price}
                  onCouponApplied={setAppliedCoupon}
                  appliedCoupon={appliedCoupon}
                  disabled={processing}
                />
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success" />
                  <span>Acesso imediato após confirmação</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success" />
                  <span>Cancele a qualquer momento</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success" />
                  <span>Pagamento seguro via Mercado Pago</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auth or Organization Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {user ? "Sua Organização" : "Acesse sua Conta"}
              </CardTitle>
              <CardDescription>
                {user
                  ? "Selecione ou crie uma organização para vincular a assinatura"
                  : "Entre ou crie uma conta para continuar"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <form onSubmit={handleAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>

                  {authError && (
                    <p className="text-sm text-destructive">{authError}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={processing}>
                    {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {authMode === "login" ? "Entrar" : "Criar Conta"}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    {authMode === "login" ? (
                      <>
                        Não tem conta?{" "}
                        <button
                          type="button"
                          onClick={() => setAuthMode("signup")}
                          className="text-primary hover:underline"
                        >
                          Criar agora
                        </button>
                      </>
                    ) : (
                      <>
                        Já tem conta?{" "}
                        <button
                          type="button"
                          onClick={() => setAuthMode("login")}
                          className="text-primary hover:underline"
                        >
                          Entrar
                        </button>
                      </>
                    )}
                  </p>
                </form>
              ) : (
                <div className="space-y-4">
                  {organizations.length > 0 && (
                    <div className="space-y-2">
                      <Label>Organização existente</Label>
                      <select
                        className="w-full p-2 border rounded-md bg-background"
                        value={selectedOrgId}
                        onChange={(e) => {
                          setSelectedOrgId(e.target.value);
                          if (e.target.value) setNewOrgName("");
                        }}
                      >
                        <option value="">Selecione...</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        {organizations.length > 0 ? "ou crie uma nova" : "Crie sua organização"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="orgName">Nome da organização</Label>
                    <Input
                      id="orgName"
                      value={newOrgName}
                      onChange={(e) => {
                        setNewOrgName(e.target.value);
                        if (e.target.value) setSelectedOrgId("");
                      }}
                      placeholder="Minha Empresa"
                    />
                  </div>

                  <Button
                    onClick={handleCheckout}
                    className="w-full"
                    disabled={processing || (!selectedOrgId && !newOrgName.trim())}
                  >
                    {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {plan.is_free ? "Ativar Plano Gratuito" : "Ir para Pagamento"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
