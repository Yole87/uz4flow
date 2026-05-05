import { HardDrive } from "lucide-react";
import { useStorageUsage } from "@/hooks/useStorageUsage";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function StorageUsageBadge() {
  const { usedMB, limitMB, percentage, isNearLimit, isAtLimit, loading } = useStorageUsage();

  if (loading) return null;

  const color = isAtLimit
    ? "text-destructive"
    : isNearLimit
      ? "text-yellow-500"
      : "text-muted-foreground";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1.5 text-xs ${color} cursor-default`}>
            <HardDrive className="h-3.5 w-3.5" />
            <span>{usedMB}/{limitMB} MB</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{Math.round(percentage)}% do armazenamento utilizado</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
