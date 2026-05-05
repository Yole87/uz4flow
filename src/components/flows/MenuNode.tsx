import { Handle, Position } from "@xyflow/react";
import { List, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuNodeProps {
  id: string;
  data: {
    menu_config?: {
      message: string;
      options: (string | { label: string; value: string })[];
      menu_type?: string;
      error_enabled?: boolean;
      error_message?: string;
    } | null;
    onDelete?: (id: string) => void;
  };
  selected?: boolean;
}

export function MenuNode({ id, data, selected }: MenuNodeProps) {
  const config = data.menu_config;
  const options = config?.options || [];
  const message = config?.message || "";

  return (
    <div
      className={cn(
        "relative group rounded-lg border-l-4 border-l-indigo-500 bg-card border border-border/60 shadow-md min-w-[200px] max-w-[260px] transition-all",
        selected && "ring-2 ring-primary shadow-lg"
      )}
    >
      {/* Target handles */}
      <Handle type="target" position={Position.Top} id="target" className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-background" />
      <Handle type="target" position={Position.Left} id="target-left" className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-background" />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
        <div className="bg-indigo-500 rounded p-1 text-white shrink-0">
          <List className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-semibold text-foreground">Menu</span>
        {data.onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); data.onDelete!(id); }}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Preview */}
      <div className="px-3 py-2 space-y-1.5">
        {message && (
          <p className="text-xs text-muted-foreground line-clamp-2">{message}</p>
        )}
        {options.length > 0 ? (
          <div className="space-y-0.5">
            {options.slice(0, 4).map((opt, i) => {
              const label = typeof opt === "string" ? opt : opt?.label || "";
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-indigo-400 shrink-0">{i + 1}.</span>
                  <span className="text-xs text-foreground truncate">{label || "(vazio)"}</span>
                </div>
              );
            })}
            {options.length > 4 && (
              <span className="text-xs text-muted-foreground">+{options.length - 4} mais...</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Clique para configurar</p>
        )}
      </div>

      {/* Dynamic output handles - one per option */}
      {options.map((opt, i) => {
        const totalOptions = options.length;
        const spacing = totalOptions > 1 ? 100 / (totalOptions + 1) : 50;
        const position = spacing * (i + 1);

        return (
          <Handle
            key={`option-${i}`}
            type="source"
            position={Position.Bottom}
            id={`option-${i}`}
            className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-background"
            style={{ left: `${position}%` }}
          />
        );
      })}

      {/* Default source handle if no options */}
      {options.length === 0 && (
        <>
          <Handle type="source" position={Position.Bottom} id="default" className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-background" />
          <Handle type="source" position={Position.Right} id="source-right" className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-background" />
        </>
      )}

      {/* Right source handle always */}
      {options.length > 0 && (
        <Handle type="source" position={Position.Right} id="source-right" className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-background" />
      )}
    </div>
  );
}
