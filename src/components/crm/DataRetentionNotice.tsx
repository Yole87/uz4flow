import { Clock } from "lucide-react";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Inline notice shown to tenants that have a data retention policy on their plan.
 * Displays "Mensagens > X dias serão removidas" as a small warning chip.
 */
export function DataRetentionNotice() {
  const { dataRetentionDays } = useOrganizationSubscription();

  if (!dataRetentionDays || dataRetentionDays <= 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning cursor-help">
            <Clock className="h-3 w-3" />
            <span>Retenção: {dataRetentionDays}d</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px]">
          Conforme seu plano, mensagens e conversas com mais de{" "}
          <strong>{dataRetentionDays} dias</strong> são removidas automaticamente
          todos os dias às 03:00 (UTC).
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
