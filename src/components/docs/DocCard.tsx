import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DocCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  steps?: string[];
  children?: React.ReactNode;
  className?: string;
}

export function DocCard({ 
  title, 
  description, 
  icon: Icon,
  steps, 
  children,
  className 
}: DocCardProps) {
  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-medium text-foreground">
          {Icon && <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />}
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {steps && steps.length > 0 && (
          <ol className="space-y-2">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm text-muted-foreground">
                <span className="flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
