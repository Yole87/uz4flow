import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Shuffle, X } from "lucide-react";

function RandomNodeComponent({ data, selected, id }: NodeProps) {
  const step = data as any;
  const config = step.random_config as { splits?: { percentage: number; label: string }[] } | null;
  const splits = config?.splits || [];
  const [hovered, setHovered] = useState(false);

  const SPLIT_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ef4444"];

  return (
    <div
      className={`relative w-[240px] rounded-lg border-l-[3px] border-l-amber-500 bg-card/90 backdrop-blur-sm border border-border/60 transition-all duration-150 cursor-pointer
        ${selected
          ? "ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/10"
          : "hover:shadow-md hover:border-border"
        }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Target handles */}
      <Handle type="target" position={Position.Top} id="target" className="!w-4 !h-4 !bg-muted !border-2 !border-border !-top-2 hover:!bg-amber-500 transition-colors" />
      <Handle type="target" position={Position.Left} id="target-left" className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-left-[7px] hover:!bg-amber-500 transition-colors" />

      {/* Delete button */}
      {hovered && step.onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); step.onDelete(id); }}
          className="absolute top-1.5 right-1.5 z-10 h-5 w-5 flex items-center justify-center rounded bg-destructive/80 hover:bg-destructive text-destructive-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Shuffle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Aleatório
          </span>
        </div>

        {splits.length > 0 ? (
          <div className="space-y-1">
            {splits.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: SPLIT_COLORS[i % SPLIT_COLORS.length] }}
                />
                <span className="text-foreground font-medium">{s.label}</span>
                <span className="text-muted-foreground ml-auto">{s.percentage}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Clique para configurar</p>
        )}
      </div>

      {/* Output handles – one per split */}
      {splits.length > 0 ? (
        splits.map((s, i) => {
          const color = SPLIT_COLORS[i % SPLIT_COLORS.length];
          const leftPct = splits.length === 1 ? 50 : 15 + (i * 70) / (splits.length - 1);
          return (
            <span key={i}>
              <Handle
                type="source"
                position={Position.Bottom}
                id={`split-${i}`}
                className="!w-4 !h-4 !border-2 !-bottom-2 transition-colors"
                style={{ left: `${leftPct}%`, backgroundColor: `${color}cc`, borderColor: color }}
              />
              <span
                className="absolute text-[8px] font-medium"
                style={{ left: `${leftPct - 3}%`, bottom: "-18px", color }}
              >
                {s.label} {s.percentage}%
              </span>
            </span>
          );
        })
      ) : (
        <Handle type="source" position={Position.Bottom} id="default" className="!w-4 !h-4 !bg-amber-500/80 !border-2 !border-amber-700 !-bottom-2" />
      )}

      {/* Right source handle */}
      <Handle type="source" position={Position.Right} id="source-right" className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-right-[7px] hover:!bg-amber-500 transition-colors" />
    </div>
  );
}

export const RandomNode = memo(RandomNodeComponent);
