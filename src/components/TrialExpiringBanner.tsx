import { useState } from "react";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";
import { Button } from "@/components/ui/button";
import { Timer, X } from "lucide-react";
import { ChangePlanDialog } from "@/components/settings/ChangePlanDialog";

const DISMISS_KEY = "trial-banner-dismissed-day";

export function TrialExpiringBanner() {
  const { isTrial, trialDaysRemaining, plan } = useOrganizationSubscription();
  const [openDialog, setOpenDialog] = useState(false);

  // Auto-reset dismiss daily
  const today = new Date().toISOString().slice(0, 10);
  const [dismissedDay, setDismissedDay] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null
  );

  // Only show when trial < 3 days and on a free plan
  if (
    !isTrial ||
    trialDaysRemaining === null ||
    trialDaysRemaining > 3 ||
    !plan?.is_free
  ) return null;

  if (dismissedDay === today) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, today);
    setDismissedDay(today);
  };

  const message =
    trialDaysRemaining <= 0
      ? "Seu teste grátis termina hoje."
      : trialDaysRemaining === 1
      ? "Seu teste grátis termina amanhã."
      : `Seu teste grátis termina em ${trialDaysRemaining} dias.`;

  return (
    <>
      <div className="bg-gradient-to-r from-primary/15 via-primary/10 to-transparent border-b border-primary/20 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Timer className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{message}</span>{" "}
            <span className="text-muted-foreground hidden sm:inline">
              Escolha um plano para continuar com acesso completo.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="default"
            className="h-7 px-3 text-xs"
            onClick={() => setOpenDialog(true)}
          >
            Escolher plano
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={dismiss}
            aria-label="Dispensar"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <ChangePlanDialog open={openDialog} onOpenChange={setOpenDialog} />
    </>
  );
}
