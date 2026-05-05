import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Phone, X } from "lucide-react";

function VoiceCallNodeComponent({ data, selected, id }: NodeProps) {
  const step = data as any;
  const cfg = step.voice_config || {};
  const [hovered, setHovered] = useState(false);

  const scriptPreview = (cfg.script || "").split("\n")[0]?.slice(0, 60) || "Clique para configurar";
  const maxDur = cfg.max_duration_seconds || 120;
  const durationLabel = maxDur < 60 ? `${maxDur}s` : `${Math.round(maxDur / 60)}min`;

  return (
    <div
      className={`relative w-[260px] rounded-lg border-l-[3px] border-l-primary bg-card/90 backdrop-blur-sm border border-border/60 transition-all duration-150 cursor-pointer
        ${selected
          ? "ring-2 ring-primary/60 shadow-lg shadow-primary/10"
          : "hover:shadow-md hover:border-border"
        }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="!w-4 !h-4 !bg-muted !border-2 !border-border !-top-2 hover:!bg-primary hover:!border-primary/60 transition-colors"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-left-[7px] hover:!bg-primary hover:!border-primary/60 transition-colors"
      />

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
        <div className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {cfg.label || "Chamada Voice AI"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 break-words leading-relaxed">
          {scriptPreview}
        </p>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground/80">
          <span className="px-1.5 py-0.5 rounded bg-muted/50">⏱ {durationLabel}</span>
          {cfg.max_attempts && cfg.max_attempts > 1 && (
            <span className="px-1.5 py-0.5 rounded bg-muted/50">↻ {cfg.max_attempts}x</span>
          )}
        </div>
      </div>

      {/* Atendida (success) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="voice-answered"
        className="!w-4 !h-4 !bg-success/80 !border-2 !border-success !-bottom-2 hover:!bg-success transition-colors"
        style={{ left: "20%" }}
      />
      <span className="absolute -bottom-5 text-[9px] font-medium text-success" style={{ left: "8%" }}>
        Atendida
      </span>

      {/* Caixa postal (warning) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="voice-voicemail"
        className="!w-4 !h-4 !bg-warning/80 !border-2 !border-warning !-bottom-2 hover:!bg-warning transition-colors"
        style={{ left: "50%" }}
      />
      <span className="absolute -bottom-5 text-[9px] font-medium text-warning" style={{ left: "40%" }}>
        Caixa postal
      </span>

      {/* Não atendeu (destructive) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="voice-no-answer"
        className="!w-4 !h-4 !bg-destructive/80 !border-2 !border-destructive !-bottom-2 hover:!bg-destructive transition-colors"
        style={{ left: "80%" }}
      />
      <span className="absolute -bottom-5 text-[9px] font-medium text-destructive" style={{ left: "70%" }}>
        Não atendeu
      </span>
    </div>
  );
}

export const VoiceCallNode = memo(VoiceCallNodeComponent);
