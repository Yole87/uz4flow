import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface McpProviderCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  onConnect: () => void;
}

export function McpProviderCard({ name, description, icon, onConnect }: McpProviderCardProps) {
  return (
    <div className="quantum-glass rounded-xl p-4 sm:p-6 flex flex-col items-center gap-4 text-center hover:border-primary/40 transition-all duration-300">
      <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <Button onClick={onConnect} variant="outline" size="sm" className="mt-auto gap-2">
        <Plus className="h-4 w-4" />
        Conectar
      </Button>
    </div>
  );
}
