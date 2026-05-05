import { Link } from "react-router-dom";
import { Lock, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOrganizationLimits, ALL_FEATURES } from "@/hooks/useOrganizationLimits";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";

interface LimitAlertProps {
  feature: string;
  className?: string;
}

export function LimitAlert({ feature, className }: LimitAlertProps) {
  const { plan } = useOrganizationSubscription();
  const { hasFeature, loading } = useOrganizationLimits();

  if (loading) return null;

  if (hasFeature(feature)) return null;

  const featureInfo = ALL_FEATURES.find(f => f.key === feature);
  const label = featureInfo?.label ?? feature;

  return (
    <Alert variant="destructive" className={className}>
      <Lock className="h-4 w-4" />
      <AlertTitle>Funcionalidade bloqueada</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>
          <strong>{label}</strong> não está disponível no plano {plan?.name || "atual"}.
          Faça upgrade para desbloquear.
        </span>
        <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
          <Link to="/conheca#pricing">
            Ver Planos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
