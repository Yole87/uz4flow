import { Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GoogleDriveIcon } from "./GoogleDriveIcon";

interface GoogleDriveConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: () => void;
  loading?: boolean;
}

const capabilities = [
  "Buscar arquivos por texto",
  "Ler conteúdo de documentos",
  "Listar arquivos recentes",
];

export function GoogleDriveConnectDialog({
  open,
  onOpenChange,
  onConnect,
  loading,
}: GoogleDriveConnectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="h-14 w-14 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center mx-auto mb-2">
            <GoogleDriveIcon className="h-8 w-8" />
          </div>
          <DialogTitle>Conectar ao Google Drive</DialogTitle>
          <DialogDescription>
            Autorize o acesso ao seu Google Drive via OAuth 2.0
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Capabilities */}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Capacidades
            </p>
            <ul className="space-y-1.5">
              {capabilities.map((cap) => (
                <li key={cap} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {cap}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1">
            <p className="text-sm text-muted-foreground">
              Você será redirecionado para o Google para autorizar o acesso somente leitura ao seu Drive. Nenhuma senha é armazenada.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading} className="w-full sm:w-auto">
            Voltar
          </Button>
          <Button onClick={onConnect} disabled={loading} className="gap-2 w-full sm:w-auto">
            <GoogleDriveIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{loading ? "Redirecionando..." : "Conectar com Google"}</span>
            <span className="sm:hidden">{loading ? "Redirecionando..." : "Conectar"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
