import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";

export function UpgradeBanner() {
  const { plan, loading } = useOrganizationSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed) return null;
  if (!plan?.is_free) return null;

  return (
    <div className="quantum-glass border-b border-primary/30 relative">
      {/* Close button - absolute on mobile for space */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground sm:hidden z-10"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-8 sm:pr-0">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 items-center justify-center hidden sm:flex">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Você está no plano <span className="text-primary font-semibold">Gratuito</span>
            <span className="text-muted-foreground ml-2 text-xs hidden sm:inline">— Faça upgrade para desbloquear mais funcionalidades</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button asChild size="sm" className="gap-1.5 text-xs sm:text-sm">
            <Link to="/conheca#pricing">
              Fazer Upgrade
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {/* Desktop close button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hidden sm:flex"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
