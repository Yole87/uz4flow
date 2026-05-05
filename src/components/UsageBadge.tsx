import { useOrganizationLimits } from "@/hooks/useOrganizationLimits";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_FEATURES } from "@/hooks/useOrganizationLimits";

interface UsageBadgeProps {
  feature: string;
  className?: string;
}

export function UsageBadge({ feature, className }: UsageBadgeProps) {
  const { hasFeature, loading } = useOrganizationLimits();

  if (loading) return null;

  const enabled = hasFeature(feature);
  const featureInfo = ALL_FEATURES.find(f => f.key === feature);
  const label = featureInfo?.label ?? feature;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={enabled ? "secondary" : "outline"}
          className={cn(
            "text-xs",
            !enabled && "opacity-50",
            className
          )}
        >
          {enabled ? <Check className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{enabled ? `${label} habilitado no seu plano` : `${label} não disponível — faça upgrade`}</p>
      </TooltipContent>
    </Tooltip>
  );
}
