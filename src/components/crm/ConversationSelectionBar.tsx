import { Button } from "@/components/ui/button";
import { Trash2, X, CheckSquare } from "lucide-react";

interface ConversationSelectionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function ConversationSelectionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDelete,
  isDeleting,
}: ConversationSelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-1 px-2 py-1.5 bg-card border-b border-border animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-xs text-foreground font-medium whitespace-nowrap">
          {selectedCount} sel.
        </span>
        {selectedCount < totalCount && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSelectAll}
            className="h-6 text-xs px-1.5 text-accent hover:text-accent hover:bg-accent/10"
          >
            <CheckSquare className="h-3 w-3 mr-0.5" />
            Todas
          </Button>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="h-6 text-xs px-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3 w-3 mr-0.5" />
          Excluir
        </Button>
      </div>
    </div>
  );
}
