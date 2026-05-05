import { Clock, AlertTriangle, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MetaWindowBarProps {
  remainingMs: number;
  windowType: string | null;
  isFromCampaign: boolean;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expirada";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getWindowColor(ms: number): string {
  if (ms <= 0) return "text-muted-foreground bg-muted";
  if (ms > 4 * 60 * 60 * 1000) return "text-emerald-400 bg-emerald-500/15";
  if (ms > 1 * 60 * 60 * 1000) return "text-yellow-400 bg-yellow-500/15";
  return "text-destructive bg-destructive/15";
}

export function MetaWindowBar({ remainingMs, windowType, isFromCampaign }: MetaWindowBarProps) {
  const colorClass = getWindowColor(remainingMs);
  const isExpired = remainingMs <= 0;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border-b border-border ${isExpired ? "bg-destructive/5" : "bg-muted/30"}`}>
      {isExpired ? (
        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
      ) : (
        <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="text-xs text-muted-foreground">
        Janela Meta {windowType || "24h"}
        {isFromCampaign && " (Campanha)"}:
      </span>
      <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 font-mono ${colorClass}`}>
        <Clock className="h-3 w-3 mr-1" />
        {formatRemaining(remainingMs)}
      </Badge>
      {isExpired && (
        <span className="text-xs text-destructive">
          Use um template para reabrir
        </span>
      )}
    </div>
  );
}
