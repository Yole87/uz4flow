import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline";
  icon?: LucideIcon;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /**
   * "default" — sem wrapper de card (use dentro de containers existentes)
   * "card" — envolve em <Card className="quantum-glass border-dashed">
   */
  variant?: "default" | "card";
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Empty state padrão do Quantum Sci-Fi UI.
 * Padroniza vazios em listagens com ícone, título, descrição e CTA(s).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  size = "md",
  className,
}: EmptyStateProps) {
  const padding =
    size === "sm"
      ? "py-8"
      : size === "lg"
        ? "py-16 sm:py-20"
        : "py-12 sm:py-16";

  const iconWrapperSize =
    size === "sm" ? "h-12 w-12" : size === "lg" ? "h-20 w-20" : "h-16 w-16";

  const iconSize =
    size === "sm" ? "h-6 w-6" : size === "lg" ? "h-10 w-10" : "h-8 w-8";

  const titleSize = size === "sm" ? "text-base" : "text-lg";

  const renderAction = (a: EmptyStateAction, primary: boolean) => {
    const ActionIcon = a.icon;
    const isPrimary = primary && (a.variant ?? "default") === "default";
    return (
      <Button
        onClick={a.onClick}
        variant={a.variant ?? (primary ? "default" : "outline")}
        className={cn(isPrimary && "gradient-primary hover:opacity-90")}
      >
        {ActionIcon && <ActionIcon className="h-4 w-4 mr-2" />}
        {a.label}
      </Button>
    );
  };

  const inner = (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-4",
        padding,
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-primary/10 mb-4",
          iconWrapperSize,
        )}
      >
        <Icon className={cn("text-primary", iconSize)} />
      </div>
      <h3 className={cn("font-semibold text-foreground mb-2", titleSize)}>
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2 justify-center w-full sm:w-auto">
          {action && renderAction(action, true)}
          {secondaryAction && renderAction(secondaryAction, false)}
        </div>
      )}
    </div>
  );

  if (variant === "card") {
    return (
      <Card className="quantum-glass border-dashed border-muted-foreground/20">
        <CardContent className="p-0">{inner}</CardContent>
      </Card>
    );
  }

  return inner;
}
