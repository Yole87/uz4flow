import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Info, LucideIcon, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  formula: string;
  icon?: LucideIcon;
  pctChange?: number | null;
  invertColors?: boolean; // for metrics where lower is better (churn, refund)
  hint?: string;
  loading?: boolean;
  accent?: "default" | "success" | "warning" | "destructive";
}

function fmtPct(n: number) {
  const abs = Math.abs(n);
  return abs >= 100 ? abs.toFixed(0) : abs.toFixed(1);
}

export function KpiCard({
  label,
  value,
  formula,
  icon: Icon,
  pctChange,
  invertColors = false,
  hint,
  loading,
  accent = "default",
}: KpiCardProps) {
  const accentClasses: Record<string, string> = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };

  const renderTrend = () => {
    if (pctChange === undefined) return null;
    if (pctChange === null) {
      return (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Minus className="w-3 h-3" /> sem comparação
        </span>
      );
    }
    const isUp = pctChange > 0;
    const isFlat = pctChange === 0;
    const positive = invertColors ? !isUp : isUp;
    const colorClass = isFlat
      ? "text-muted-foreground"
      : positive
        ? "text-success"
        : "text-destructive";
    const Arrow = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;
    return (
      <span className={cn("text-xs flex items-center gap-1", colorClass)}>
        <Arrow className="w-3 h-3" />
        {fmtPct(pctChange)}% vs período anterior
      </span>
    );
  };

  return (
    <Card className="relative">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {Icon ? <Icon className="h-4 w-4 text-muted-foreground shrink-0" /> : null}
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {label}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0"
                aria-label="Como é calculado"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="end"
              sideOffset={8}
              collisionPadding={12}
              className="max-w-[280px] z-[200] bg-popover text-popover-foreground border"
            >
              <p className="text-xs leading-relaxed">{formula}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="space-y-1">
          {loading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <div className={cn("text-2xl font-bold", accentClasses[accent])}>
              {value}
            </div>
          )}
          {renderTrend()}
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
