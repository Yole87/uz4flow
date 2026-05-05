import { Lightbulb, Info, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type CalloutType = "tip" | "info" | "warning" | "danger";

interface DocCalloutProps {
  type: CalloutType;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const calloutConfig = {
  tip: {
    icon: Lightbulb,
    bg: "bg-success/10",
    border: "border-success/30",
    iconColor: "text-success",
    title: "Dica",
  },
  info: {
    icon: Info,
    bg: "bg-accent/10",
    border: "border-accent/30",
    iconColor: "text-accent",
    title: "Informação",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-warning/10",
    border: "border-warning/30",
    iconColor: "text-warning",
    title: "Atenção",
  },
  danger: {
    icon: AlertCircle,
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    iconColor: "text-destructive",
    title: "Importante",
  },
};

export function DocCallout({ type, title, children, className }: DocCalloutProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex gap-3 p-3 sm:p-4 rounded-lg border",
        config.bg,
        config.border,
        className
      )}
    >
      <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5", config.iconColor)} />
      <div className="space-y-1">
        <p className={cn("text-sm font-medium", config.iconColor)}>
          {title || config.title}
        </p>
        <div className="text-sm text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}
