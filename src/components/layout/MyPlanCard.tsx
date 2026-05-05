import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Timer, Calendar, Loader2, ArrowUpRight, PackageOpen } from "lucide-react";
import { ChangePlanDialog } from "@/components/settings/ChangePlanDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MyPlanCard() {
  const { plan, subscription, isTrial, trialDaysRemaining, isActive, isOverdue, isTrialExpired, loading } = useOrganizationSubscription();
  const [openDialog, setOpenDialog] = useState(false);
  const navigate = useNavigate();

  // Compute days until next billing for paid plans
  const nextBillingDays = (() => {
    const end = subscription?.current_period_end;
    if (!end) return null;
    const diff = new Date(end).getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 p-4 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No subscription at all (e.g. affiliate-only account, or signup without checkout).
  // Show a neutral CTA card instead of an infinite spinner.
  if (!plan && !subscription) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <PackageOpen className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Meu plano</p>
        </div>
        <h4 className="text-base font-semibold">Você ainda não tem um plano</h4>
        <p className="text-xs text-muted-foreground">
          Conheça os planos OpenFlow para usar o CRM, automações e muito mais.
        </p>
        <Button
          size="sm"
          variant="default"
          className="w-full"
          onClick={() => navigate("/conheca")}
        >
          Ver planos
          <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    );
  }

  const planName = plan?.name || "Sem plano";
  const isFree = plan?.is_free || plan?.price === 0;
  const cycle = (subscription as any)?.billing_cycle || "monthly";
  const cycleLabels: Record<string, string> = { monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", yearly: "Anual" };

  return (
    <>
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-4 space-y-3 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between gap-2 relative">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Meu plano
            </p>
            <h4 className="text-base font-semibold mt-0.5 truncate">{planName}</h4>
          </div>
          {isActive ? (
            <Badge variant="secondary" className="bg-success/15 text-success border-success/30 shrink-0">Ativo</Badge>
          ) : isOverdue ? (
            <Badge variant="destructive" className="shrink-0">Pendente</Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">Inativo</Badge>
          )}
        </div>

        {/* Price + cycle */}
        <div className="text-sm text-muted-foreground">
          {isFree ? (
            <span>Plano gratuito</span>
          ) : (
            <span>R$ {plan?.price?.toFixed(2)} • {cycleLabels[cycle] || "Mensal"}</span>
          )}
        </div>

        {/* Trial countdown */}
        {isTrial && trialDaysRemaining !== null && (
          <div className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <Timer className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-medium text-foreground">
              {trialDaysRemaining > 0
                ? `Faltam ${trialDaysRemaining} dia${trialDaysRemaining > 1 ? "s" : ""} do seu teste`
                : "Seu teste expira hoje"}
            </span>
          </div>
        )}

        {/* Trial expired warning for free plan */}
        {isTrialExpired && (
          <div className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <Timer className="w-3.5 h-3.5 text-destructive shrink-0" />
            <span className="font-medium text-foreground">
              Seu período de teste expirou. Escolha um plano pago para continuar.
            </span>
          </div>
        )}

        {/* Next billing for paid active plans */}
        {!isTrial && !isTrialExpired && isActive && nextBillingDays !== null && !isFree && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {nextBillingDays > 1
                ? `Renova em ${nextBillingDays} dias (${format(new Date(subscription!.current_period_end!), "dd 'de' MMM", { locale: ptBR })})`
                : nextBillingDays === 1
                ? `Renova amanhã (${format(new Date(subscription!.current_period_end!), "dd 'de' MMM", { locale: ptBR })})`
                : "Renova hoje"}
            </span>
          </div>
        )}

        <Button
          size="sm"
          variant={isTrialExpired ? "destructive" : "default"}
          className="w-full mt-1"
          onClick={() => isTrialExpired ? navigate("/conheca") : setOpenDialog(true)}
        >
          {isTrialExpired ? "Ver planos pagos" : "Mudar plano"}
          <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>

      <ChangePlanDialog open={openDialog} onOpenChange={setOpenDialog} />
    </>
  );
}
