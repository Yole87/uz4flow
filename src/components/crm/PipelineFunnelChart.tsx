import { useState, useMemo } from "react";
import { FunnelChart, type FunnelStage } from "@/components/ui/funnel-chart";

interface StageMetric {
  id: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
}

interface PipelineFunnelChartProps {
  stages: StageMetric[];
  total: number;
}

// Paleta fallback Quantum (8 cores neon) — usada quando estágio não tem cor configurada
const FALLBACK_PALETTE = [
  "#FF1B6B", // pink
  "#8B5CF6", // purple
  "#06B6D4", // cyan
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#3B82F6", // blue
  "#EC4899", // rose
];

/**
 * Funil quântico premium: usa o componente FunnelChart com camadas (rings)
 * animadas via Framer Motion. Mantém legenda lateral acessível e bloco TOTAL.
 */
export function PipelineFunnelChart({ stages, total }: PipelineFunnelChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const data = useMemo<FunnelStage[]>(() => {
    // Resolve cores efetivas (com fallback) primeiro, para usar a cor do
    // estágio anterior como início do gradiente do atual.
    const colors = stages.map(
      (s, idx) => s.color || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length],
    );
    return stages.map((s, idx) => {
      const color = colors[idx];
      const prevColor = idx === 0 ? color : colors[idx - 1];
      return {
        label: s.name,
        value: Math.max(s.count, 0),
        color,
        // Degradê horizontal: começa na cor do estágio anterior, termina na cor atual.
        gradient: [
          { offset: "0%", color: prevColor },
          { offset: "100%", color },
        ],
      };
    });
  }, [stages]);

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhum estágio configurado
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        {/* Funil */}
        <div className="flex-1 w-full min-w-0">
          <div className="quantum-glass rounded-xl border border-border/40 bg-card/30 p-4">
            <FunnelChart
              data={data}
              orientation="horizontal"
              layers={2}
              edges="curved"
              staggerDelay={0.08}
              gap={2}
              hoveredIndex={hoveredIndex}
              onHoverChange={setHoveredIndex}
              className="h-[260px]"
              formatValue={(v) =>
                v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
              }
              formatPercentage={(p) => `${p.toFixed(1)}%`}
            />
          </div>
        </div>

        {/* Legenda lateral (acessibilidade + scan rápido) */}
        <div className="w-full lg:w-56 shrink-0 space-y-1.5">
          {stages.map((s, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <button
                key={s.id}
                type="button"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`w-full flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-all ${
                  isHovered
                    ? "border-accent/60 bg-accent/10 shadow-[0_0_12px_hsl(var(--accent)/0.25)]"
                    : "border-border/60 bg-card/40 hover:bg-card/70"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0 ring-2 ring-background"
                  style={{ backgroundColor: s.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    {s.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.count} {s.count === 1 ? "contato" : "contatos"} •{" "}
                    {s.percentage.toFixed(1)}%
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Total */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-foreground">TOTAL</span>
          <span className="text-base font-bold text-accent">
            {total} {total === 1 ? "contato" : "contatos"} (100%)
          </span>
        </div>
      </div>
    </div>
  );
}
