import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:shadow-[0_0_10px_hsl(338_100%_53%/0.3),0_0_20px_hsl(338_100%_53%/0.1)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
