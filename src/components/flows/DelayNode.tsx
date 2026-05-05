import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Clock, X } from "lucide-react";

function DelayNodeComponent({ data, selected, id }: NodeProps) {
  const step = data as any;
  const config = step.delay_config as { delay_seconds?: number } | null;
  const seconds = config?.delay_seconds ?? 0;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`relative w-[200px] rounded-lg border-l-[3px] border-l-gray-500 bg-card/90 backdrop-blur-sm border border-border/60 transition-all duration-150 cursor-pointer
        ${selected
          ? "ring-2 ring-gray-400/60 shadow-lg shadow-gray-500/10"
          : "hover:shadow-md hover:border-border"
        }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Target handles */}
      <Handle type="target" position={Position.Top} id="target" className="!w-4 !h-4 !bg-muted !border-2 !border-border !-top-2 hover:!bg-gray-500 transition-colors" />
      <Handle type="target" position={Position.Left} id="target-left" className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-left-[7px] hover:!bg-gray-500 transition-colors" />

      {/* Delete button */}
      {hovered && step.onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); step.onDelete(id); }}
          className="absolute top-1.5 right-1.5 z-10 h-5 w-5 flex items-center justify-center rounded bg-destructive/80 hover:bg-destructive text-destructive-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div className="p-3 space-y-1">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Intervalo
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {seconds > 0 ? `${seconds} segundo${seconds !== 1 ? "s" : ""}` : "Clique para configurar"}
        </p>
      </div>

      {/* Source handles */}
      <Handle type="source" position={Position.Bottom} id="default" className="!w-4 !h-4 !bg-gray-500/80 !border-2 !border-gray-700 !-bottom-2 hover:!bg-gray-400 transition-colors" />
      <Handle type="source" position={Position.Right} id="source-right" className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-right-[7px] hover:!bg-gray-500 transition-colors" />
    </div>
  );
}

export const DelayNode = memo(DelayNodeComponent);
