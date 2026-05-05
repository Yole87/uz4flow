import { ReactNode, useEffect, useState, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CreditCard, Clock, Ban } from "lucide-react";
import { Link } from "react-router-dom";
import { getImpersonatedOrgId } from "@/hooks/useImpersonation";
import { toast } from "sonner";

interface SubscriptionGuardProps {
  children: ReactNode;
  requireSubscription?: boolean;
  allowPending?: boolean;
}

export function SubscriptionGuard({ 
  children, 
  requireSubscription = true,
  allowPending = false
}: SubscriptionGuardProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const location = useLocation();
  const { 
    organization, 
    subscription, 
    plan,
    isActive, 
    isBlocked, 
    isPending,
    isTrialExpired,
    isOwner,
    isOverdue,
    overdueDays,
    trialDaysRemaining,
    loading: subLoading,
    refetch,
  } = useOrganizationSubscription();

  // Admin check with React Query shared cache
  const { data: isAdmin = false, isLoading: adminLoading } = useQuery({
    queryKey: ["is-admin-master", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('role', 'admin_master')
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  // Still loading - NEVER render blocked screens while loading
  if (authLoading || subLoading || (!!user && adminLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Admin users bypass subscription check and redirect to admin panel (unless impersonating)
  const impersonatedOrgId = getImpersonatedOrgId();
  if (isAdmin && location.pathname === '/dashboard' && !impersonatedOrgId) {
    return <Navigate to="/admin" replace />;
  }

  // Admin users can access any route
  if (isAdmin) {
    return <>{children}</>;
  }

  // If subscription is not required, just render children
  if (!requireSubscription) {
    return <>{children}</>;
  }

  // Secondary members see a different blocked screen when subscription is not active
  if (!isOwner && organization && (!isActive || isBlocked || isPending || isTrialExpired || !subscription)) {
    return (
      <BlockedScreen
        icon={<Ban className="h-12 w-12 text-destructive" />}
        title="Acesso Expirado"
        description="O acesso da conta expirou, peça ao assinante verificar o acesso do plano."
        actionLabel="Sair"
        onAction={signOut}
      />
    );
  }

  // No organization - needs to subscribe
  if (!organization) {
    return (
      <BlockedScreen
        icon={<CreditCard className="h-12 w-12 text-primary" />}
        title="Escolha um Plano"
        description="Para começar a usar o OpenFlow, você precisa escolher um plano de assinatura."
        actionLabel="Ver Planos"
        actionUrl="/conheca"
      />
    );
  }

  // Organization is blocked
  if (isBlocked) {
    return (
      <BlockedScreen
        icon={<Ban className="h-12 w-12 text-destructive" />}
        title="Acesso Bloqueado"
        description={organization.block_reason || "Sua organização está temporariamente bloqueada. Entre em contato com o suporte para mais informações."}
        actionLabel="Entrar em Contato"
        actionUrl="mailto:suporte@openflow.studio"
      />
    );
  }

  // No subscription
  if (!subscription) {
    return (
      <BlockedScreen
        icon={<CreditCard className="h-12 w-12 text-primary" />}
        title="Assinatura Necessária"
        description="Sua organização ainda não possui uma assinatura ativa. Escolha um plano para continuar."
        actionLabel="Ver Planos"
        actionUrl="/conheca"
      />
    );
  }

  // Subscription pending payment — auto-check + retry
  if (isPending && !allowPending) {
    return (
      <PendingPaymentScreen
        planName={plan?.name}
        onStatusResolved={async () => { await refetch(); }}
        signOut={signOut}
      />
    );
  }

  // Grace period: subscription is overdue but within 4-day window
  if (isOverdue && isOwner) {
    const daysLeft = Math.max(0, 4 - overdueDays);
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive/90 text-destructive-foreground px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">
                {daysLeft > 1
                  ? `Pagamento pendente — restam ${daysLeft} dias para regularizar antes da suspensão.`
                  : daysLeft === 1
                  ? "Pagamento pendente — sua conta será suspensa amanhã se não regularizar."
                  : "Último dia para regularizar seu pagamento. Suspensão iminente!"}
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="flex-shrink-0"
              onClick={() => window.location.href = "/conheca"}
            >
              Regularizar
            </Button>
          </div>
        </div>
        <div className="pt-12">
          {children}
        </div>
      </>
    );
  }

  // Suspended after grace period (D+4+)
  if (subscription?.status === "suspended") {
    return (
      <BlockedScreen
        icon={<Ban className="h-12 w-12 text-destructive" />}
        title="Assinatura Suspensa"
        description="Sua assinatura foi suspensa por falta de pagamento. Regularize para restaurar o acesso. Suas configurações foram preservadas."
        actionLabel="Ver Planos"
        actionUrl="/conheca"
      />
    );
  }

  // Trial expired
  if (isTrialExpired) {
    return (
      <BlockedScreen
        icon={<Clock className="h-12 w-12 text-warning" />}
        title="Período de Teste Expirado"
        description={`Seu teste grátis de ${trialDaysRemaining === 0 ? (plan?.name || 'plano') : plan?.name || 'plano'} expirou. Escolha um plano pago para continuar usando todas as funcionalidades.`}
        actionLabel="Ver Planos"
        actionUrl="/conheca"
      />
    );
  }

  // Subscription expired or cancelled
  if (!isActive) {
    return (
      <BlockedScreen
        icon={<AlertTriangle className="h-12 w-12 text-warning" />}
        title="Assinatura Expirada"
        description={`Sua assinatura do plano ${plan?.name || ''} expirou ou foi cancelada. Renove para continuar usando.`}
        actionLabel="Ver Planos"
        actionUrl="/conheca"
      />
    );
  }

  // All checks passed - render children
  return <>{children}</>;
}

interface BlockedScreenProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionUrl?: string;
  onAction?: () => void;
  showRefresh?: boolean;
}

function BlockedScreen({ 
  icon, 
  title, 
  description, 
  actionLabel, 
  actionUrl,
  onAction,
  showRefresh 
}: BlockedScreenProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background via-secondary/20 to-background">
      <Card className="w-full max-w-md text-center shadow-xl">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            {icon}
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {onAction ? (
            <Button className="w-full" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : (
            <Button asChild className="w-full">
              <a href={actionUrl!}>{actionLabel}</a>
            </Button>
          )}
          {showRefresh && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Atualizar Página
            </Button>
          )}
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/">Ir para Início</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Pending Payment Screen with auto-check + retry ──────────────────
interface PendingPaymentScreenProps {
  planName?: string | null;
  onStatusResolved: () => Promise<void>;
  signOut: () => void;
}

function PendingPaymentScreen({ planName, onStatusResolved, signOut }: PendingPaymentScreenProps) {
  const [checking, setChecking] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const { user } = useAuth();

  // Auto-check on mount
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setChecking(true);
      try {
        await onStatusResolved();
      } catch {
        // ignore
      }
      if (!cancelled) setChecking(false);
    };
    check();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime listener — detect when webhook activates subscription
  useEffect(() => {
    if (!user) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) return;

      channel = supabase
        .channel("pending-payment-guard")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "subscriptions",
            filter: `organization_id=eq.${membership.organization_id}`,
          },
          async (payload) => {
            const newStatus = (payload.new as any)?.status;
            if (newStatus === "active") {
              await onStatusResolved();
            }
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user, onStatusResolved]);

  const handleRetryPayment = useCallback(async () => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-subscription", {
        body: {
          action: "retry-checkout",
          backUrl: `${window.location.origin}/subscription/callback`,
        },
      });

      if (error || !data?.initPoint) {
        toast.error(data?.error || "Erro ao gerar link de pagamento. Tente novamente.");
        return;
      }

      // Redirect to MercadoPago checkout
      window.location.href = data.initPoint;
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setRetrying(false);
    }
  }, []);

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Verificando status do pagamento...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background via-secondary/20 to-background">
      <Card className="w-full max-w-md text-center shadow-xl">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Clock className="h-12 w-12 text-warning" />
          </div>
          <CardTitle className="text-2xl">Pagamento Pendente</CardTitle>
          <CardDescription className="text-base">
            {planName
              ? `Seu pagamento para o plano ${planName} ainda não foi concluído. Finalize o pagamento para ativar sua conta.`
              : "Seu pagamento ainda não foi concluído. Finalize o pagamento para ativar sua conta."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full"
            onClick={handleRetryPayment}
            disabled={retrying}
          >
            {retrying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Gerando link...
              </>
            ) : (
              "Realizar Pagamento"
            )}
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/conheca">Escolher outro plano</Link>
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/">Ir para Início</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
