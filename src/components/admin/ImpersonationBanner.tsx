import { useEffect } from "react";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck } from "lucide-react";

const BANNER_HEIGHT_PX = 40;

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedOrgName, stopImpersonation } = useImpersonation();
  const navigate = useNavigate();

  // Reserve vertical space at the top of the page so the fixed banner never
  // covers the app shell, regardless of which page wraps in AppLayout.
  useEffect(() => {
    if (!isImpersonating) return;
    const prev = document.body.style.paddingTop;
    document.body.style.paddingTop = `${BANNER_HEIGHT_PX}px`;
    return () => {
      document.body.style.paddingTop = prev;
    };
  }, [isImpersonating]);

  if (!isImpersonating) return null;

  const handleStop = () => {
    stopImpersonation();
    navigate("/admin/organizations");
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 bg-warning px-4 text-warning-foreground text-sm font-medium shadow-md"
      style={{ height: BANNER_HEIGHT_PX }}
      role="status"
      aria-label="Modo Suporte ativo"
    >
      <ShieldCheck className="h-4 w-4 shrink-0" />
      <span className="truncate">
        Modo Suporte — <strong>{impersonatedOrgName || "Organização"}</strong>
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-warning/70 bg-warning/40 text-warning-foreground hover:bg-warning/60 ml-2"
        onClick={handleStop}
      >
        <LogOut className="h-3.5 w-3.5 mr-1.5" />
        Encerrar
      </Button>
    </div>
  );
}
