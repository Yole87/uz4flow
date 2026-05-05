import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface McpConnectionCardProps {
  provider: string;
  description: string | null;
  isActive: boolean;
  icon: React.ReactNode;
  onToggle: (active: boolean) => void;
  onRemove: () => void;
}

export function McpConnectionCard({
  provider,
  description,
  isActive,
  icon,
  onToggle,
  onRemove,
}: McpConnectionCardProps) {
  return (
    <div className="quantum-glass rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
      <div className="h-10 w-10 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">{provider}</span>
          <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
            {isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        )}
      </div>
      <Switch checked={isActive} onCheckedChange={onToggle} />
      <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
