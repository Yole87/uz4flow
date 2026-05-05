/**
 * Adaptador legado do `useToast` original.
 *
 * Toda chamada agora é encaminhada para o Sonner, que já está montado
 * em `App.tsx` (`<Sonner />` em `src/components/ui/sonner.tsx`).
 *
 * Isso garante que TODOS os toasts do sistema apareçam SEMPRE acima de
 * modais e overlays — sem precisar caçar tela por tela.
 *
 * A API antiga (`toast({ title, description, variant })`) é preservada,
 * então nenhum componente legado precisa ser reescrito.
 */
import { toast as sonnerToast } from "sonner";

export interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
  // Legacy compat — silently ignored
  action?: unknown;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function callSonner(opts: ToastOptions) {
  const title = typeof opts.title === "string" ? opts.title : opts.title ? String(opts.title) : "";
  const description =
    typeof opts.description === "string"
      ? opts.description
      : opts.description
      ? String(opts.description)
      : undefined;

  const params = {
    description,
    duration: opts.duration ?? 5000,
  };

  if (opts.variant === "destructive") {
    return sonnerToast.error(title || "Erro", params);
  }
  return sonnerToast(title, params);
}

export function toast(opts: ToastOptions = {}) {
  const id = callSonner(opts);
  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
    update: (next: ToastOptions) => callSonner(next),
  };
}

export function useToast() {
  return {
    toast,
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
    toasts: [] as Array<{ id: string }>,
  };
}
