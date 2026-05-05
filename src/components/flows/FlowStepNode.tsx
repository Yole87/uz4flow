import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  FileText,
  Clock,
  MessageCircleQuestion,
  Variable,
  FileInput,
  X,
} from "lucide-react";

function FlowStepNodeComponent({ data, selected, id }: NodeProps) {
  const step = data as any;
  const [hovered, setHovered] = useState(false);

  const isText = step.step_type === "text";
  const borderColor = isText ? "border-l-blue-500" : "border-l-purple-500";
  const iconColor = isText ? "text-blue-400" : "text-purple-400";
  const Icon = isText ? MessageSquare : FileText;

  return (
    <div
      className={`relative w-[260px] rounded-lg border-l-[3px] ${borderColor} bg-card/90 backdrop-blur-sm border border-border/60 transition-all duration-150 cursor-pointer
        ${selected
          ? "ring-2 ring-primary/60 shadow-lg shadow-primary/10"
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
        className="!w-4 !h-4 !bg-muted !border-2 !border-border !-top-2 hover:!bg-primary hover:!border-primary/60 transition-colors"
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
        <div className="flex items-center gap-1.5 flex-wrap">
          <Icon className={`h-3.5 w-3.5 ${iconColor} shrink-0`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isText ? "Mensagem" : "Arquivo"}
          </span>
          {step.delay_ms > 0 && (
            <Badge variant="outline" className="gap-0.5 text-[9px] py-0 px-1.5 ml-auto">
              <Clock className="h-2.5 w-2.5" />
              {step.delay_ms >= 60000 && step.delay_ms % 60000 === 0
                ? `${step.delay_ms / 60000}min`
                : `${step.delay_ms / 1000}s`}
            </Badge>
          )}
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1 flex-wrap">
          {step.requires_response && (
            <Badge className="bg-primary/15 text-primary border-primary/20 gap-0.5 text-[9px] py-0 px-1.5">
              <MessageCircleQuestion className="h-2.5 w-2.5" />
              Resp.
            </Badge>
          )}
          {step.variable_name && (
            <Badge variant="outline" className="gap-0.5 text-[9px] py-0 px-1.5">
              <Variable className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate max-w-[100px]">{step.variable_name}</span>
            </Badge>
          )}
          {step.accept_file_response && (
            <Badge variant="outline" className="gap-0.5 text-[9px] py-0 px-1.5">
              <FileInput className="h-2.5 w-2.5" />
            </Badge>
          )}
          {step.isLast && (
            <Badge className="bg-success/15 text-success border-success/20 text-[9px] py-0 px-1.5">
              Última
            </Badge>
          )}
        </div>

        {/* Content preview */}
        <p className="text-xs text-muted-foreground line-clamp-2 break-words leading-relaxed">
          {isText
            ? step.text_content || "Sem conteúdo"
            : step.file?.file_name || "Arquivo"}
        </p>
      </div>

      {/* Left handle (target) */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-left-[7px] hover:!bg-primary hover:!border-primary/60 transition-colors"
      />

      {/* Right handle (source) */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-right-[7px] hover:!bg-primary hover:!border-primary/60 transition-colors"
      />

      {/* Source handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!w-4 !h-4 !bg-muted !border-2 !border-border !-bottom-2 hover:!bg-primary hover:!border-primary/60 transition-colors"
      />
    </div>
  );
}

export const FlowStepNode = memo(FlowStepNodeComponent);
