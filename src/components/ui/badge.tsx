import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-mono font-semibold uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/40 bg-primary/15 text-primary shadow-[0_0_8px_hsl(338_100%_53%/0.15)]",
        secondary:
          "border-secondary/40 bg-secondary/15 text-secondary shadow-[0_0_8px_hsl(272_100%_50%/0.15)]",
        destructive:
          "border-destructive/40 bg-destructive/15 text-destructive shadow-[0_0_8px_hsl(0_84%_60%/0.15)]",
        outline: "text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  },
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
