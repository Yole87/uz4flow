import { useEffect, useState } from "react";
import { Clock, AlertTriangle, Timer, Instagram, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface IgWindowBarProps {
  expiresAt: string | null | undefined;
  humanAgentMode?: boolean;
  onToggleHumanAgent?: (enabled: boolean) => void;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expirada";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getColor(ms: number): string {
  if (ms <= 0) return "text-muted-foreground bg-muted";
  if (ms > 4 * 60 * 60 * 1000) return "text-emerald-400 bg-emerald-500/15";
  if (ms > 1 * 60 * 60 * 1000) return "text-yellow-400 bg-yellow-500/15";
  return "text-destructive bg-destructive/15";
}

export function IgWindowBar({ expiresAt, humanAgentMode = false, onToggleHumanAgent }: IgWindowBarProps) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!expiresAt) { setRemainingMs(0); return; }
    const target = new Date(expiresAt).getTime();
    const calc = () => setRemainingMs(Math.max(0, target - Date.now()));
    calc();
    const i = setInterval(calc, 1000);
    return () => clearInterval(i);
  }, [expiresAt]);

  const expired = remainingMs <= 0;
  const colorClass = getColor(remainingMs);

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border-b border-border ${expired ? "bg-destructive/5" : "bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-orange-500/5"}`}>
      <Instagram className="h-3.5 w-3.5 shrink-0 text-pink-400" />
      {expired ? (
        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
      ) : (
        <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="text-xs text-muted-foreground">Janela DM Instagram (24h):</span>
      <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 font-mono ${colorClass}`}>
        <Clock className="h-3 w-3 mr-1" />
        {formatRemaining(remainingMs)}
      </Badge>
      {expired && onToggleHumanAgent && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {humanAgentMode ? "Modo Atendente Humano ativo (até 7d)" : "Janela expirada"}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={humanAgentMode ? "default" : "outline"}
                  className="h-6 text-xs gap-1"
                  onClick={() => onToggleHumanAgent(!humanAgentMode)}
                >
                  <UserCheck className="h-3 w-3" />
                  {humanAgentMode ? "Atendente Humano ON" : "Ativar Atendente Humano"}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Permite responder até 7 dias após a última mensagem do usuário usando a etiqueta HUMAN_AGENT da Meta. Use apenas quando um humano estiver atendendo.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
