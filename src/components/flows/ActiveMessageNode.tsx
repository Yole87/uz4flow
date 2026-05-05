import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Send, Trash2, AlertTriangle } from "lucide-react";

function ActiveMessageNodeComponent({ data, selected }: NodeProps) {
  const config = (data as any)?.active_message_config as {
    instance_id?: string;
    filter_tags?: string[];
    recipients?: string[];
    content_items?: any[];
    meta_template_name?: string;
  } | null;

  const tags = config?.filter_tags || [];
  const recipients = config?.recipients || [];
  const items = config?.content_items || [];
  const metaTemplate = config?.meta_template_name;
  const onDelete = (data as any)?.onDelete;
  const stepId = (data as any)?.id;

  let preview = "Clique para configurar";
  if (metaTemplate) {
    preview = `Template: ${metaTemplate}`;
  } else if (tags.length > 0 && recipients.length > 0) {
    preview = `Tags: ${tags.join(", ")} + ${recipients.length} nº`;
  } else if (tags.length > 0) {
    preview = `Via tags: ${tags.join(", ")}`;
  } else if (recipients.length > 0) {
    preview = `${recipients.length} destinatário(s)`;
  }
  if (!metaTemplate && items.length > 0) {
    preview += ` · ${items.length} item(ns)`;
  }

  return (
    <div
      className={`relative group rounded-lg border-2 bg-card shadow-lg min-w-[180px] max-w-[240px] transition-all ${
        selected ? "border-emerald-500 shadow-emerald-500/30" : "border-emerald-500/40 hover:border-emerald-500/70"
      }`}
    >
      <Handle type="target" position={Position.Top} id="target" className="!w-3 !h-3 !bg-emerald-500 !border-background" />
      <Handle type="target" position={Position.Left} id="target-left" className="!w-3 !h-3 !bg-emerald-500 !border-background" />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="bg-emerald-600 rounded p-1 text-white shrink-0">
            <Send className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground truncate">Mensagem Ativa</span>
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
          {preview}
        </p>
        {metaTemplate && (
          <div className="flex items-center gap-1 mt-1">
            <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
            <span className="text-[9px] text-amber-500">Meta Template</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} id="default" className="!w-3 !h-3 !bg-emerald-500 !border-background" />
      <Handle type="source" position={Position.Right} id="source-right" className="!w-3 !h-3 !bg-emerald-500 !border-background" />
    </div>
  );
}

export const ActiveMessageNode = memo(ActiveMessageNodeComponent);
