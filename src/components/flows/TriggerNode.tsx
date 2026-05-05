import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Zap, Key, CalendarClock, Star, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TriggerNodeData {
  scheduleEnabled?: boolean;
  scheduleType?: string | null;
  scheduleConfig?: any;
  isDefault?: boolean;
  routingRules?: { match_type: string; match_value: string }[];
  hasConflicts?: boolean;
  onClick?: () => void;
}

function TriggerNodeComponent({ data }: { data: TriggerNodeData }) {
  const { scheduleEnabled, scheduleType, scheduleConfig, isDefault, routingRules = [], hasConflicts, onClick } = data;

  const hasRules = routingRules.length > 0;
  const hasSchedule = scheduleEnabled;
  const hasTrigger = hasRules || hasSchedule || isDefault;

  const formatSchedule = () => {
    if (!scheduleType || !scheduleConfig) return "";
    const time = `${String(scheduleConfig.hour ?? 0).padStart(2, "0")}:${String(scheduleConfig.minute ?? 0).padStart(2, "0")}`;
    if (scheduleType === "weekdays" && scheduleConfig.weekdays) {
      const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const days = (scheduleConfig.weekdays as number[]).map((d: number) => labels[d]).join(", ");
      return `${days} ${time}`;
    }
    if (scheduleType === "after_days") {
      return `A cada ${scheduleConfig.days}d ${time}`;
    }
    return "";
  };

  return (
    <div
      className="group cursor-pointer select-none"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <div className={`relative min-w-[200px] max-w-[260px] rounded-xl border-2 ${hasConflicts ? "border-warning/60" : "border-success/60"} bg-gradient-to-br from-success/20 to-success/5 shadow-[0_0_20px_hsl(var(--success)/0.15)] transition-all duration-200 group-hover:border-success group-hover:shadow-[0_0_30px_hsl(var(--success)/0.25)]`}>
        {/* Conflict indicator */}
        {hasConflicts && (
          <div className="absolute -top-2 -right-2 bg-warning rounded-full p-1 shadow-lg">
            <AlertTriangle className="h-3 w-3 text-warning-foreground" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-success/20">
          <div className="bg-success rounded-lg p-1.5 text-success-foreground shadow-[0_0_10px_hsl(var(--success)/0.4)]">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Trigger</p>
            <p className="text-xs text-muted-foreground">
              {hasTrigger ? "Gatilho configurado" : "Clique para configurar"}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="px-4 py-2.5 space-y-1.5">
          {!hasTrigger && (
            <p className="text-xs text-muted-foreground italic">Nenhum gatilho ativo</p>
          )}

          {hasRules && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Key className="h-3 w-3 text-warning shrink-0" />
              {routingRules.slice(0, 3).map((r, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-xs px-1.5 py-0 h-5 bg-warning/15 text-warning border-warning/30"
                >
                  {r.match_value || r.match_type}
                </Badge>
              ))}
              {routingRules.length > 3 && (
                <span className="text-xs text-muted-foreground">+{routingRules.length - 3}</span>
              )}
            </div>
          )}

          {hasSchedule && (
            <div className="flex items-center gap-1.5">
              <CalendarClock className="h-3 w-3 text-accent shrink-0" />
              <span className="text-xs text-accent">{formatSchedule()}</span>
            </div>
          )}

          {isDefault && (
            <div className="flex items-center gap-1.5">
              <Star className="h-3 w-3 text-warning shrink-0" />
              <span className="text-xs text-warning">Fluxo padrão (fallback)</span>
            </div>
          )}

          {hasConflicts && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
              <span className="text-xs text-warning">Conflito com outro fluxo</span>
            </div>
          )}
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!w-4 !h-4 !bg-success !border-2 !border-success/40 !shadow-[0_0_8px_hsl(var(--success)/0.5)]"
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
