import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn-laser-cut relative overflow-hidden inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold uppercase tracking-wider ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary/90 text-primary-foreground shadow-[0_0_15px_hsl(338_100%_53%/0.4)] hover:bg-primary hover:shadow-[0_0_25px_hsl(338_100%_53%/0.6)]",
        destructive:
          "bg-destructive/90 text-destructive-foreground shadow-[0_0_15px_hsl(0_84%_60%/0.3)] hover:bg-destructive hover:shadow-[0_0_25px_hsl(0_84%_60%/0.5)]",
        outline:
          "border border-primary/40 bg-transparent text-primary hover:bg-primary/10 hover:shadow-[0_0_15px_hsl(338_100%_53%/0.2)]",
        secondary:
          "bg-secondary/80 text-secondary-foreground shadow-[0_0_15px_hsl(272_100%_50%/0.3)] hover:bg-secondary hover:shadow-[0_0_25px_hsl(272_100%_50%/0.5)]",
        ghost:
          "hover:bg-accent/10 hover:text-accent",
        link: "text-primary underline-offset-4 hover:underline [clip-path:none]",
        warning:
          "bg-warning/90 text-warning-foreground shadow-[0_0_15px_hsl(38_92%_50%/0.3)] hover:bg-warning hover:shadow-[0_0_25px_hsl(38_92%_50%/0.5)]",
        success:
          "bg-success/90 text-success-foreground shadow-[0_0_15px_hsl(142_71%_45%/0.3)] hover:bg-success hover:shadow-[0_0_25px_hsl(142_71%_45%/0.5)]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 text-xs btn-laser-cut-sm",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
