import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CircleStop, X } from "lucide-react";

function EndNodeComponent({ data, selected, id }: NodeProps) {
  const step = data as any;
  const [hovered, setHovered] = useState(false);
  const endConfig = step.end_config || {};
  const finalMessage = endConfig.final_message || "";

  return (
    <div
      className={`relative w-[220px] rounded-lg border-l-[3px] border-l-red-500 bg-card/90 backdrop-blur-sm border border-border/60 transition-all duration-150 cursor-pointer
        ${selected
          ? "ring-2 ring-red-400/60 shadow-lg shadow-red-500/10"
          : "hover:shadow-md hover:border-border"
        }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Target handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="!w-4 !h-4 !bg-muted !border-2 !border-border !-top-2 hover:!bg-red-500 hover:!border-red-400/60 transition-colors"
      />

      {/* Left handle (target) */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-left-[7px] hover:!bg-red-500 hover:!border-red-400/60 transition-colors"
      />

      {/* Delete button on hover */}
      {hovered && step.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            step.onDelete(id);
          }}
          className="absolute top-1.5 right-1.5 z-10 h-5 w-5 flex items-center justify-center rounded bg-destructive/80 hover:bg-destructive text-destructive-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div className="p-3 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <CircleStop className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fim do Fluxo
          </span>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 break-words leading-relaxed">
          {finalMessage
            ? finalMessage.substring(0, 60) + (finalMessage.length > 60 ? "..." : "")
            : "Encerra e desativa fluxo"}
        </p>
      </div>

      {/* No source handles - this is a terminal node */}
    </div>
  );
}

export const EndNode = memo(EndNodeComponent);
