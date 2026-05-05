import { useState, useEffect } from "react";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";
import { useOrganizationLimits, ALL_FEATURES } from "@/hooks/useOrganizationLimits";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CheckCircle, Clock, AlertTriangle, CreditCard, Calendar, Shield, Loader2, Check, X, Timer } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";
import { StorageUsageCard } from "@/components/StorageUsageCard";
import { ChangePlanDialog } from "@/components/settings/ChangePlanDialog";

type SubscriptionPayment = Tables<"subscription_payments">;

interface SubscriptionTabProps {
  /** Whether to render the StorageUsageCard inside this tab. Defaults to true for backwards compat. */
  showStorage?: boolean;
}

export function SubscriptionTab({ showStorage = true }: SubscriptionTabProps = {}) {
  const { organization, subscription, plan, isActive, isPending, isTrial, trialDaysRemaining, loading, refetch } = useOrganizationSubscription();
  const { features } = useOrganizationLimits();
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [openChangePlan, setOpenChangePlan] = useState(false);

  useEffect(() => {
    if (organization?.id) fetchPayments();
  }, [organization?.id]);

  const fetchPayments = async () => {
    if (!organization?.id) return;
    setLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error("Error fetching payments:", err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.id) {
      toast.error("Não foi possível identificar a assinatura");
      return;
    }
    setCancelling(true);
    try {
      const { error } = await supabase.functions.invoke("mercadopago-subscription", {
        body: { action: "cancel-subscription", subscriptionId: subscription.id },
      });
      if (error) throw error;
      toast.success("Assinatura cancelada com sucesso");
      refetch();
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      toast.error("Erro ao cancelar assinatura");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization || !subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sem Assinatura</CardTitle>
          <CardDescription>Você ainda não possui uma assinatura ativa.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpenChangePlan(true)}>Ver Planos Disponíveis</Button>
          <ChangePlanDialog open={openChangePlan} onOpenChange={setOpenChangePlan} />
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    active: { label: "Ativa", icon: CheckCircle, variant: "default" as const, color: "text-green-500" },
    pending: { label: "Pendente", icon: Clock, variant: "secondary" as const, color: "text-yellow-500" },
    cancelled: { label: "Cancelada", icon: AlertTriangle, variant: "destructive" as const, color: "text-red-500" },
    paused: { label: "Pausada", icon: Clock, variant: "secondary" as const, color: "text-gray-500" },
  };

  const status = statusConfig[subscription.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
                <CreditCard className="h-5 w-5" />
                {plan?.name || "Plano"}
              </CardTitle>
              <CardDescription>{plan?.description || "Sua assinatura atual"}</CardDescription>
            </div>
            <Badge variant={status.variant} className="flex items-center gap-1 self-start sm:self-auto">
              <StatusIcon className={`h-4 w-4 ${status.color}`} />
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Valor</p>
              <p className="font-semibold">{plan?.is_free ? "Grátis" : `R$ ${plan?.price?.toFixed(2) || "0,00"}/mês`}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ciclo de Cobrança</p>
              <p className="font-semibold">
                {(() => {
                  const cycle = (subscription as any)?.billing_cycle || "monthly";
                  const labels: Record<string, string> = { monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", yearly: "Anual" };
                  return labels[cycle] || "Mensal";
                })()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Próxima cobrança</p>
              <p className="font-semibold">
                {subscription.current_period_end 
                  ? format(new Date(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Início do período</p>
              <p className="font-semibold">
                {subscription.current_period_start 
                  ? format(new Date(subscription.current_period_start), "dd/MM/yyyy", { locale: ptBR })
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Organização</p>
              <p className="font-semibold">{organization.name}</p>
            </div>
          </div>
          {isTrial && trialDaysRemaining !== null && subscription?.trial_end && (
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  {trialDaysRemaining > 0
                    ? `Seu período de teste termina em ${trialDaysRemaining} dia${trialDaysRemaining > 1 ? 's' : ''}`
                    : "Seu período de teste expira hoje"}
                </p>
              </div>
              {(() => {
                const totalDays = (plan as any)?.trial_days || 7;
                const elapsed = totalDays - trialDaysRemaining;
                const progress = Math.min(100, (elapsed / totalDays) * 100);
                return <Progress value={progress} className="h-2" />;
              })()}
              <p className="text-xs text-muted-foreground">
                Expira em {new Date(subscription.trial_end).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpenChangePlan(true)} className="w-full sm:w-auto">Alterar Plano</Button>
            {subscription.status === "active" && !plan?.is_free && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={cancelling}>
                    {cancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Cancelar Assinatura
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar Assinatura?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ao cancelar sua assinatura, você perderá acesso às funcionalidades premium ao final do período atual.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelSubscription}>Confirmar Cancelamento</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Storage Usage Card (optional) */}
      {showStorage && <StorageUsageCard />}

      {/* Features Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Funcionalidades do Plano
          </CardTitle>
          <CardDescription>Módulos incluídos na sua assinatura</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_FEATURES.map(({ key, label, description }) => {
              const enabled = features.includes(key);
              return (
                <div
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    enabled ? "bg-success/5 border-success/20" : "bg-muted/30 border-border opacity-50"
                  }`}
                >
                  <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    enabled ? "bg-success/20" : "bg-muted"
                  }`}>
                    {enabled ? (
                      <Check className="w-3 h-3 text-success" />
                    ) : (
                      <X className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${enabled ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Histórico de Pagamentos
          </CardTitle>
          <CardDescription>Últimos pagamentos da sua assinatura</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPayments ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum pagamento registrado</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center flex-wrap justify-between gap-2 py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">R$ {payment.amount.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      {payment.paid_at 
                        ? format(new Date(payment.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant={payment.status === "approved" ? "default" : "secondary"}>
                    {payment.status === "approved" ? "Aprovado" : payment.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ChangePlanDialog open={openChangePlan} onOpenChange={setOpenChangePlan} />
    </div>
  );
}
