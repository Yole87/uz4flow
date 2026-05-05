import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { GitBranch, X } from "lucide-react";

function ConditionNodeComponent({ data, selected, id }: NodeProps) {
  const step = data as any;
  const config = step.condition_config || {};
  const [hovered, setHovered] = useState(false);

  const operatorLabels: Record<string, string> = {
    equals: "=",
    not_equals: "≠",
    contains: "contém",
    not_contains: "!contém",
    starts_with: "inicia",
    ends_with: "termina",
    greater_than: ">",
    less_than: "<",
    is_empty: "vazio",
    is_not_empty: "!vazio",
    regex: "regex",
  };

  return (
    <div
      className={`relative w-[260px] rounded-lg border-l-[3px] border-l-warning bg-card/90 backdrop-blur-sm border border-border/60 transition-all duration-150 cursor-pointer
        ${selected
          ? "ring-2 ring-warning/60 shadow-lg shadow-warning/10"
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
        className="!w-4 !h-4 !bg-muted !border-2 !border-border !-top-2 hover:!bg-warning hover:!border-warning/60 transition-colors"
      />

      {/* Left handle (target) */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-left-[7px] hover:!bg-warning hover:!border-warning/60 transition-colors"
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

      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-warning shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Condição
          </span>
        </div>

        {/* Condition preview */}
        <p className="text-xs text-muted-foreground line-clamp-2 break-words leading-relaxed">
          {config.variable
            ? `{{${config.variable}}} ${operatorLabels[config.operator] || "?"} ${config.value || ""}`
            : "Clique para configurar"}
        </p>
      </div>

      {/* True output */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!w-4 !h-4 !bg-success/80 !border-2 !border-success !-bottom-2 hover:!bg-success transition-colors"
        style={{ left: "30%" }}
      />
      <span className="absolute -bottom-5 text-[9px] font-medium text-success" style={{ left: "22%" }}>
        Sim
      </span>

      {/* False output */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!w-4 !h-4 !bg-destructive/80 !border-2 !border-destructive !-bottom-2 hover:!bg-destructive transition-colors"
        style={{ left: "70%" }}
      />
      <span className="absolute -bottom-5 text-[9px] font-medium text-destructive" style={{ left: "64%" }}>
        Não
      </span>

      {/* Right handle (source) for lateral connections */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-right-[7px] hover:!bg-warning hover:!border-warning/60 transition-colors"
      />
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
