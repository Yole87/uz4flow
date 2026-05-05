import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ListOrdered, Trash2 } from "lucide-react";

function LaneNodeComponent({ data, selected }: NodeProps) {
  const laneConfig = (data as any)?.lane_config as { stage_id?: string; stage_name?: string } | null;
  const stageName = laneConfig?.stage_name || "";
  const onDelete = (data as any)?.onDelete;
  const stepId = (data as any)?.id;

  return (
    <div
      className={`relative group rounded-lg border-2 bg-card shadow-lg min-w-[180px] max-w-[240px] transition-all ${
        selected ? "border-teal-500 shadow-teal-500/30" : "border-teal-500/40 hover:border-teal-500/70"
      }`}
    >
      <Handle type="target" position={Position.Top} id="target" className="!w-3 !h-3 !bg-teal-500 !border-background" />
      <Handle type="target" position={Position.Left} id="target-left" className="!w-3 !h-3 !bg-teal-500 !border-background" />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="bg-teal-500 rounded p-1 text-white shrink-0">
            <ListOrdered className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground truncate">Lane</span>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(stepId); }}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/20 rounded"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-snug truncate">
          {stageName ? `Mover para: ${stageName}` : "Clique para configurar"}
        </p>
      </div>

      <Handle type="source" position={Position.Bottom} id="default" className="!w-3 !h-3 !bg-teal-500 !border-background" />
      <Handle type="source" position={Position.Right} id="source-right" className="!w-3 !h-3 !bg-teal-500 !border-background" />
    </div>
  );
}

export const LaneNode = memo(LaneNodeComponent);
