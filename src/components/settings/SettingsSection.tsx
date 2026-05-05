import { ReactNode } from "react";
import { LucideIcon, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsSectionProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  onHelpClick?: () => void;
  children: ReactNode;
}

/**
 * Standard wrapper for every Settings page subsection.
 * Provides consistent header, padding, typography across the Settings module.
 */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  actions,
  onHelpClick,
  children,
}: SettingsSectionProps) {
  return (
    <section className="w-full max-w-5xl">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-5 mb-6 border-b border-border/60">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-foreground tracking-tight truncate">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {onHelpClick && (
            <Button variant="ghost" size="sm" onClick={onHelpClick} className="gap-1.5">
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Ajuda</span>
            </Button>
          )}
        </div>
      </header>

      <div className="space-y-6">{children}</div>
    </section>
  );
}
