import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

/**
 * Tooltip — open ONLY on click/tap (no hover).
 *
 * The Radix Tooltip is, by default, hover-driven. We wrap it so that all
 * existing consumers (`<Tooltip>`, `<TooltipTrigger asChild>`, `<TooltipContent>`)
 * keep their current API but the open state is controlled by us and tied
 * exclusively to click/tap. Hover & focus events are intercepted so they
 * never open the tooltip.
 *
 * Auto-closes after AUTO_CLOSE_MS or when the user clicks outside / scrolls.
 */

const AUTO_CLOSE_MS = 4000;

interface CtxShape {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const TooltipCtx = React.createContext<CtxShape | null>(null);

const TooltipProvider = ({ children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider delayDuration={0} disableHoverableContent {...props}>
    {children}
  </TooltipPrimitive.Provider>
);

const Tooltip: React.FC<React.ComponentProps<typeof TooltipPrimitive.Root>> = ({
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...rootProps
}) => {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = React.useState<boolean>(!!defaultOpen);
  const open = isControlled ? !!openProp : internalOpen;

  const setOpen = React.useCallback(
    (v: boolean) => {
      if (!isControlled) setInternalOpen(v);
      onOpenChange?.(v);
    },
    [isControlled, onOpenChange],
  );

  // Auto-close
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, setOpen]);

  return (
    <TooltipCtx.Provider value={{ open, setOpen }}>
      <TooltipPrimitive.Root
        {...rootProps}
        open={open}
        onOpenChange={(next) => {
          // Block Radix's hover-driven openings; only allow our own closures.
          if (!next) setOpen(false);
        }}
        delayDuration={0}
        disableHoverableContent
      >
        {children}
      </TooltipPrimitive.Root>
    </TooltipCtx.Provider>
  );
};

/**
 * TooltipTrigger — keeps `asChild` and other props compatible, but routes
 * opening through a click handler instead of hover/focus.
 */
const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onClick, onPointerDown, onPointerEnter, onPointerLeave, onFocus, onBlur, ...props }, ref) => {
  const ctx = React.useContext(TooltipCtx);

  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      {...props}
      onClick={(e) => {
        ctx?.setOpen(!ctx.open);
        onClick?.(e);
      }}
      // Swallow hover/focus events so Radix can't open from them.
      onPointerDown={(e) => {
        onPointerDown?.(e);
      }}
      onPointerEnter={(e) => {
        e.preventDefault();
        onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        onPointerLeave?.(e);
      }}
      onFocus={(e) => {
        // Don't open on focus
        onFocus?.(e);
      }}
      onBlur={(e) => {
        onBlur?.(e);
      }}
    />
  );
});
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, onPointerDownOutside, ...props }, ref) => {
  const ctx = React.useContext(TooltipCtx);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        onPointerDownOutside={(e) => {
          ctx?.setOpen(false);
          onPointerDownOutside?.(e);
        }}
        className={cn(
          "z-[9999] overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
