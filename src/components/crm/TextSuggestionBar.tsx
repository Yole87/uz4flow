import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface TextSuggestionBarProps {
  suggestions: string[];
  isLoading: boolean;
  onSelect: (suggestion: string) => void;
}

export function TextSuggestionBar({ suggestions, isLoading, onSelect }: TextSuggestionBarProps) {
  if (!isLoading && suggestions.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-border bg-muted/30 overflow-x-auto">
      {isLoading && (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
      )}
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className={cn(
            "shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors",
            "border-border bg-card text-foreground hover:bg-accent/10 hover:border-accent/30 hover:text-accent"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
