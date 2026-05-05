import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  MessageSquare,
  Music,
  Video,
  Image,
  FileText,
  Clock,
  X,
} from "lucide-react";

const CONTENT_ICONS: Record<string, typeof MessageSquare> = {
  text: MessageSquare,
  audio: Music,
  video: Video,
  image: Image,
  file: FileText,
  interval: Clock,
};

const CONTENT_LABELS: Record<string, string> = {
  text: "Texto",
  audio: "Áudio",
  video: "Vídeo",
  image: "Imagem",
  file: "Arquivo",
  interval: "Intervalo",
};

function FlowBlockNodeComponent({ data, selected, id }: NodeProps) {
  const step = data as any;
  const [hovered, setHovered] = useState(false);
  const blockContents: any[] = step.block_contents || [];

  return (
    <div
      className={`relative w-[260px] rounded-lg border-l-[3px] border-l-orange-500 bg-card/90 backdrop-blur-sm border border-border/60 transition-all duration-150 cursor-pointer
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
          <Layers className="h-3.5 w-3.5 text-orange-400 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bloco
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1.5 ml-auto">
            {blockContents.length} {blockContents.length === 1 ? "item" : "itens"}
          </Badge>
        </div>

        {/* Content preview list */}
        {blockContents.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Clique para adicionar conteúdos
          </p>
        ) : (
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {blockContents.map((item: any, idx: number) => {
              const Icon = CONTENT_ICONS[item.type] || FileText;
              const label = CONTENT_LABELS[item.type] || item.type;
              let preview = "";
              if (item.type === "text") {
                preview = item.content ? (item.content.length > 30 ? item.content.slice(0, 30) + "…" : item.content) : "";
              } else if (item.type === "interval") {
                const secs = (item.delayMs || 0) / 1000;
                preview = secs >= 60 ? `${secs / 60}min` : `${secs}s`;
              } else if (item.fileName) {
                preview = item.fileName;
              }
              return (
                <div key={idx} className="flex items-center gap-1.5 text-xs">
                  <Icon className="h-3 w-3 text-orange-400 shrink-0" />
                  <span className="text-muted-foreground truncate">
                    {label}{preview ? `: ${preview}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-left-[7px] hover:!bg-primary hover:!border-primary/60 transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!w-3.5 !h-3.5 !bg-muted !border-2 !border-border !-right-[7px] hover:!bg-primary hover:!border-primary/60 transition-colors"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!w-4 !h-4 !bg-muted !border-2 !border-border !-bottom-2 hover:!bg-primary hover:!border-primary/60 transition-colors"
      />
    </div>
  );
}

export const FlowBlockNode = memo(FlowBlockNodeComponent);
