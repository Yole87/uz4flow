import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarIcon, RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { DashboardFiltersState } from "@/hooks/admin/useAdminDashboardData";
import { OrganizationFilter } from "./OrganizationFilter";

type Preset = "today" | "7d" | "30d" | "quarter" | "year" | "custom";

interface DashboardFiltersProps {
  filters: DashboardFiltersState;
  onChange: (next: DashboardFiltersState) => void;
  onRefresh: () => void;
  onExport: () => void;
  loading?: boolean;
}

function buildRange(preset: Preset, customRange?: { from?: Date; to?: Date }) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (preset) {
    case "today":
      break;
    case "7d":
      start.setDate(start.getDate() - 6);
      break;
    case "30d":
      start.setDate(start.getDate() - 29);
      break;
    case "quarter":
      start.setDate(start.getDate() - 89);
      break;
    case "year":
      start.setDate(start.getDate() - 364);
      break;
    case "custom":
      if (customRange?.from && customRange?.to) {
        start.setTime(customRange.from.getTime());
        start.setHours(0, 0, 0, 0);
        end.setTime(customRange.to.getTime());
        end.setHours(23, 59, 59, 999);
      }
      break;
  }
  return { start, end };
}

function buildCompareRange(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  const compareEnd = new Date(start.getTime() - 1);
  const compareStart = new Date(compareEnd.getTime() - diff);
  return { compareStart, compareEnd };
}

export function DashboardFilters({
  filters,
  onChange,
  onRefresh,
  onExport,
  loading,
}: DashboardFiltersProps) {
  const [preset, setPreset] = useState<Preset>(() => {
    const saved = localStorage.getItem("admin-dashboard-preset");
    return (saved as Preset) || "30d";
  });
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});

  const applyPreset = (p: Preset, range?: { from?: Date; to?: Date }) => {
    const { start, end } = buildRange(p, range);
    const { compareStart, compareEnd } = buildCompareRange(start, end);
    setPreset(p);
    localStorage.setItem("admin-dashboard-preset", p);
    onChange({
      ...filters,
      start: start.toISOString(),
      end: end.toISOString(),
      compareStart: compareStart.toISOString(),
      compareEnd: compareEnd.toISOString(),
    });
  };

  const presets: { id: Preset; label: string }[] = [
    { id: "today", label: "Hoje" },
    { id: "7d", label: "7 dias" },
    { id: "30d", label: "30 dias" },
    { id: "quarter", label: "Trimestre" },
    { id: "year", label: "Ano" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-1 flex-wrap">
        {presets.map((p) => (
          <Button
            key={p.id}
            variant={preset === p.id ? "default" : "ghost"}
            size="sm"
            className="px-2.5"
            onClick={() => applyPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={preset === "custom" ? "default" : "ghost"}
              size="sm"
              className={cn("gap-1 px-2.5")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {preset === "custom" && customRange.from && customRange.to
                ? `${format(customRange.from, "dd/MM", { locale: ptBR })} – ${format(customRange.to, "dd/MM", { locale: ptBR })}`
                : "Personalizado"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={customRange as { from: Date; to?: Date }}
              onSelect={(r) => {
                const next = { from: r?.from, to: r?.to };
                setCustomRange(next);
                if (next.from && next.to) applyPreset("custom", next);
              }}
              numberOfMonths={2}
              locale={ptBR}
              disabled={(date) => date > new Date()}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="hidden md:block h-6 w-px bg-border mx-1" />

      <OrganizationFilter
        value={filters.organizationId ?? null}
        onChange={(orgId) => {
          localStorage.setItem("admin-dashboard-org", orgId || "");
          onChange({ ...filters, organizationId: orgId });
        }}
      />

      <div className="hidden md:block h-6 w-px bg-border mx-1" />

      <div className="flex items-center gap-2 shrink-0">
        <Switch
          id="compare-toggle"
          checked={filters.compareEnabled}
          onCheckedChange={(v) =>
            onChange({ ...filters, compareEnabled: v })
          }
        />
        <Label htmlFor="compare-toggle" className="text-xs cursor-pointer whitespace-nowrap">
          Comparar com período anterior
        </Label>
      </div>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="px-2.5">
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} />
          Atualizar
        </Button>
        <Button variant="outline" size="sm" onClick={onExport} className="px-2.5">
          <Download className="h-3.5 w-3.5 mr-1" />
          Exportar CSV
        </Button>
      </div>
    </div>
  );
}

export { buildRange, buildCompareRange };
