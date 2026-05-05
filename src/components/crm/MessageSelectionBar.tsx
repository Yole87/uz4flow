import { Button } from "@/components/ui/button";
import { Copy, Trash2, Forward, X } from "lucide-react";

interface MessageSelectionBarProps {
  count: number;
  onCopy: () => void;
  onDelete: () => void;
  onForward: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function MessageSelectionBar({
  count,
  onCopy,
  onDelete,
  onForward,
  onCancel,
  isDeleting,
}: MessageSelectionBarProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-card border-b border-border animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground font-medium">
          {count} selecionada(s)
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Copiar</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onForward}
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          <Forward className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Encaminhar</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Apagar</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
