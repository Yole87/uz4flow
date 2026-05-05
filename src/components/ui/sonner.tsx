import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Sonner global da aplicação.
 *
 * CORREÇÃO DEFINITIVA:
 * - renderiza via portal em `document.body`
 * - assim ele sai do stacking context do app/root
 * - e passa a competir no mesmo nível dos portals do Radix Dialog
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      expand
      richColors
      style={{ zIndex: 2147483646 }}
      toastOptions={{
        duration: 5000,
        style: { zIndex: 2147483646 },
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-2 group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:opacity-90",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error:
            "group-[.toaster]:!bg-destructive group-[.toaster]:!text-destructive-foreground group-[.toaster]:!border-destructive-foreground/30 [&_[data-description]]:!text-destructive-foreground [&_[data-description]]:!opacity-100 [&_[data-title]]:!text-destructive-foreground [&_[data-icon]]:!text-destructive-foreground",
          success:
            "group-[.toaster]:!bg-emerald-600 group-[.toaster]:!text-white group-[.toaster]:!border-emerald-400/40 [&_[data-description]]:!text-white [&_[data-title]]:!text-white [&_[data-icon]]:!text-white",
          warning:
            "group-[.toaster]:!bg-yellow-500 group-[.toaster]:!text-yellow-950 group-[.toaster]:!border-yellow-300 [&_[data-description]]:!text-yellow-950 [&_[data-title]]:!text-yellow-950",
        },
      }}
      {...props}
    />,
    document.body
  );
};

export { Toaster, toast };
