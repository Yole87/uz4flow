import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export type ReportPeriodPreset = "today" | "7d" | "30d" | "90d" | "custom";

export interface ReportPeriod {
  preset: ReportPeriodPreset;
  start: Date;
  end: Date;
}

export interface ReportInstance {
  id: string;
  name: string;
  provider?: string | null;
}

interface ReportFiltersProps {
  period: ReportPeriod;
  onPeriodChange: (p: ReportPeriod) => void;
  instanceId: string | null;
  onInstanceChange: (id: string | null) => void;
  instances: ReportInstance[];
}

export function buildPeriod(preset: Exclude<ReportPeriodPreset, "custom">): ReportPeriod {
  const end = new Date();
  let start: Date;
  if (preset === "today") {
    start = new Date(end);
    start.setHours(0, 0, 0, 0);
  } else if (preset === "7d") start = subDays(end, 7);
  else if (preset === "30d") start = subDays(end, 30);
  else start = subDays(end, 90);
  return { preset, start, end };
}

export function ReportFilters({
  period,
  onPeriodChange,
  instanceId,
  onInstanceChange,
  instances,
}: ReportFiltersProps) {
  const presetLabel: Record<ReportPeriodPreset, string> = {
    today: "Hoje",
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias",
    custom: "Personalizado",
  };

  const periodLabel = useMemo(() => {
    return `${format(period.start, "dd/MM/yyyy")} — ${format(period.end, "dd/MM/yyyy")}`;
  }, [period.start, period.end]);

  const dateRange: DateRange = { from: period.start, to: period.end };

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <Select
        value={period.preset}
        onValueChange={(v) => {
          if (v === "custom") {
            onPeriodChange({ ...period, preset: "custom" });
          } else {
            onPeriodChange(buildPeriod(v as Exclude<ReportPeriodPreset, "custom">));
          }
        }}
      >
        <SelectTrigger className="w-[160px] h-9 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(presetLabel) as ReportPeriodPreset[]).map((k) => (
            <SelectItem key={k} value={k} className="text-xs">
              {presetLabel[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {period.preset === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-9 gap-1.5 text-xs sm:text-sm", !dateRange.from && "text-muted-foreground")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateRange.from && dateRange.to
                ? `${format(dateRange.from, "dd/MM")} → ${format(dateRange.to, "dd/MM")}`
                : "Escolher datas"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              locale={ptBR}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onPeriodChange({ preset: "custom", start: range.from, end: range.to });
                }
              }}
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}

      <Select
        value={instanceId ?? "all"}
        onValueChange={(v) => onInstanceChange(v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[180px] h-9 text-xs">
          <SelectValue>
            <div className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">
                {instanceId ? instances.find((i) => i.id === instanceId)?.name ?? "Instância" : "Todas as instâncias"}
              </span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            Todas as instâncias
          </SelectItem>
          {instances.map((inst) => (
            <SelectItem key={inst.id} value={inst.id} className="text-xs">
              <div className="flex items-center gap-1.5">
                <span>{inst.name}</span>
                {inst.provider === "meta_official" && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-500/30 text-blue-400 ml-1">
                    Meta
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground hidden md:inline">{periodLabel}</span>
    </div>
  );
}
