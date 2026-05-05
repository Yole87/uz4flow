import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SmartLabel } from "@/hooks/useSmartLabels";

interface SmartLabelBadgeProps {
  label: SmartLabel;
  size?: "xs" | "sm";
  className?: string;
  onRemove?: () => void;
}

export function SmartLabelBadge({ label, size = "xs", className, onRemove }: SmartLabelBadgeProps) {
  const Icon = (label.icon && (Icons as any)[label.icon]) as LucideIcon | undefined;
  const isXs = size === "xs";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium leading-none whitespace-nowrap",
        isXs ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-1",
        className
      )}
      style={{
        backgroundColor: `${label.color}20`,
        color: label.color,
        borderColor: `${label.color}50`,
      }}
      title={label.name}
    >
      {Icon && <Icon className={isXs ? "h-2.5 w-2.5" : "h-3 w-3"} />}
      <span className="truncate max-w-[120px]">{label.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70 ml-0.5"
          aria-label={`Remover ${label.name}`}
        >
          <Icons.X className={isXs ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </button>
      )}
    </span>
  );
}

interface SmartLabelListProps {
  labelKeys: string[];
  allLabels: SmartLabel[];
  size?: "xs" | "sm";
  max?: number;
  className?: string;
}

export function SmartLabelList({ labelKeys, allLabels, size = "xs", max = 3, className }: SmartLabelListProps) {
  if (!labelKeys?.length) return null;
  const map = new Map(allLabels.map((l) => [l.key, l]));
  const visible = labelKeys.slice(0, max).map((k) => map.get(k)).filter(Boolean) as SmartLabel[];
  const overflow = Math.max(0, labelKeys.length - max);

  if (!visible.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((l) => (
        <SmartLabelBadge key={l.id} label={l} size={size} />
      ))}
      {overflow > 0 && (
        <span className="text-xs text-muted-foreground font-medium">+{overflow}</span>
      )}
    </div>
  );
}
