import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: () => void;
  onSkip: () => void;
}

export function WelcomeDialog({ open, onOpenChange, onStart, onSkip }: WelcomeDialogProps) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    (user?.email?.split("@")[0] ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="quantum-glass border-primary/30 sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary neon-glow-pink">
            <Rocket className="h-7 w-7 text-white" />
          </div>
          <DialogTitle className="text-center text-xl sm:text-2xl">
            Bem-vindo ao Uz4Flow{firstName ? `, ${firstName}` : ""}! 🎉
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            Vamos configurar seu CRM em <strong className="text-foreground">5 passos</strong> — leva
            cerca de <strong className="text-foreground">5 minutos</strong>.
          </DialogDescription>
        </DialogHeader>

        <ul className="my-2 space-y-2 text-sm text-muted-foreground">
          {[
            "Conectar um número de WhatsApp",
            "Configurar seu funil Kanban",
            "Criar seu primeiro fluxo",
            "Convidar a equipe (opcional)",
            "Importar contatos (opcional)",
          ].map((label, i) => (
            <li key={i} className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onSkip();
            }}
          >
            Pular por enquanto
          </Button>
          <Button
            className="gradient-primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onStart();
            }}
          >
            <Rocket className="mr-2 h-4 w-4" />
            Começar setup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
