import { useState, useEffect } from "react";
import { LucideIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DocSectionProps {
  id: string;
  title: string;
  icon: LucideIcon;
  description?: string;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export function DocSection({ 
  id, 
  title, 
  icon: Icon, 
  description, 
  children,
  className,
  defaultOpen = false,
}: DocSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Listen for section selection events to auto-expand
  useEffect(() => {
    const handler = (e: Event) => {
      const selectedId = (e as CustomEvent).detail;
      if (selectedId === id) {
        setOpen(true);
      }
    };
    window.addEventListener("docs-section-select", handler);
    return () => window.removeEventListener("docs-section-select", handler);
  }, [id]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section 
        id={id} 
        className={cn("scroll-mt-20 py-4 border-b border-border last:border-b-0", className)}
      >
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-3 w-full text-left group cursor-pointer py-2 px-1 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 shrink-0">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-xl font-bold text-foreground">{title}</h2>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200 shrink-0",
              open && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 sm:space-y-6 pt-3 sm:pt-4 pl-1">
            {children}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
