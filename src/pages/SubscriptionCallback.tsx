import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react";

type SubscriptionStatus = "loading" | "success" | "pending" | "error";

export default function SubscriptionCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>("loading");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(5);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        setStatus("error");
        setMessage("Organização não encontrada");
        return;
      }

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans(*)")
        .eq("organization_id", membership.organization_id)
        .single();

      if (!subscription) {
        setStatus("error");
        setMessage("Assinatura não encontrada");
        return;
      }

      const urlStatus = searchParams.get("status");

      if (urlStatus === "authorized" || subscription.status === "active") {
        setStatus("success");
        setMessage("Sua assinatura foi ativada com sucesso!");
      } else if (urlStatus === "pending" || subscription.status === "pending") {
        setStatus("pending");
        setMessage("Seu pagamento está sendo processado. Você receberá uma confirmação em breve.");
      } else if (urlStatus === "cancelled") {
        setStatus("error");
        setMessage("O pagamento foi cancelado. Tente novamente.");
      } else {
        if (subscription.status === "active") {
          setStatus("success");
          setMessage("Sua assinatura está ativa!");
        } else {
          setStatus("pending");
          setMessage("Aguardando confirmação do pagamento...");
        }
      }
    } catch (err) {
      console.error("Error checking subscription:", err);
      setStatus("error");
      setMessage("Erro ao verificar status da assinatura");
    }
  }, [user, searchParams]);

  // Initial check
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      checkSubscriptionStatus();
    }
  }, [user, authLoading, checkSubscriptionStatus, navigate]);

  // Realtime listener for instant status detection
  useEffect(() => {
    if (!user || status === "success" || status === "error") return;

    const setupRealtime = async () => {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) return;

      realtimeRef.current = supabase
        .channel("subscription-callback")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "subscriptions",
            filter: `organization_id=eq.${membership.organization_id}`,
          },
          (payload) => {
            const newStatus = (payload.new as any)?.status;
            if (newStatus === "active") {
              setStatus("success");
              setMessage("Sua assinatura foi ativada com sucesso!");
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current);
      }
    };
  }, [user, status]);

  // Auto-redirect when status is success
  useEffect(() => {
    if (status === "success") {
      // Cleanup polling and realtime when success
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            navigate("/dashboard");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status, navigate]);

  // Polling fallback for pending status
  useEffect(() => {
    if (status === "pending") {
      pollingRef.current = setInterval(() => {
        checkSubscriptionStatus();
      }, 5000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [status, checkSubscriptionStatus]);

  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Verificando status da assinatura...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {status === "success" && (
            <>
              <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
              <CardTitle className="text-success">Assinatura Confirmada!</CardTitle>
            </>
          )}
          {status === "pending" && (
            <>
              <Clock className="h-16 w-16 text-warning mx-auto mb-4" />
              <CardTitle className="text-warning">Pagamento Pendente</CardTitle>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <CardTitle className="text-destructive">Erro na Assinatura</CardTitle>
            </>
          )}
          <CardDescription className="text-base">{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "success" && (
            <div className="bg-success/10 p-4 rounded-lg text-sm space-y-2">
              <p className="text-success-foreground">
                Você já pode acessar todos os recursos do seu plano. Aproveite!
              </p>
              <p className="text-success font-medium">
                Redirecionando para o dashboard em {countdown} segundos...
              </p>
            </div>
          )}

          {status === "pending" && (
            <div className="bg-warning/10 p-4 rounded-lg text-sm space-y-2">
              <p className="text-warning-foreground">
                O pagamento pode levar alguns minutos para ser confirmado.
              </p>
              <p className="text-warning-foreground">
                Esta página será atualizada automaticamente quando o pagamento for detectado.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="bg-destructive/10 p-4 rounded-lg text-sm">
              <p className="text-destructive">
                Se o problema persistir, entre em contato com nosso suporte.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to="/dashboard">Ir para o Dashboard</Link>
            </Button>
            
            {status === "error" && (
              <Button variant="outline" asChild className="w-full">
                <Link to="/">Voltar para Início</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
