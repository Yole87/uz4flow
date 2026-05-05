import { Copy, Code2, Cpu, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FlowStep {
  id: string;
  step_type: string;
  text_content: string | null;
  requires_response: boolean;
  variable_name: string | null;
  order_index: number;
}

interface FlowVariablesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: FlowStep[];
}

const SYSTEM_VARIABLES = [
  { name: "pushName", description: "Nome do contato no WhatsApp" },
  { name: "chatId", description: "ID do chat / número do contato" },
  { name: "instanceId", description: "ID da instância conectada" },
  { name: "messageText", description: "Texto da mensagem recebida" },
];

export function FlowVariablesDialog({ open, onOpenChange, steps }: FlowVariablesDialogProps) {
  const collectedVars = steps
    .filter((s) => s.requires_response && s.variable_name)
    .map((s) => ({
      name: s.variable_name!,
      stepIndex: s.order_index,
      stepType: s.step_type,
    }));

  const copyVar = (name: string) => {
    navigator.clipboard.writeText(`{{${name}}}`);
    toast.success(`{{${name}}} copiado!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Variáveis do Fluxo
          </DialogTitle>
          <DialogDescription>
            Use variáveis nas mensagens com a sintaxe {"{{variavel}}"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {/* System variables */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Sistema
                </span>
              </div>
              <div className="space-y-1">
                {SYSTEM_VARIABLES.map((v) => (
                  <div
                    key={v.name}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="font-mono text-xs shrink-0">
                        {`{{${v.name}}}`}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        {v.description}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copyVar(v.name)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Collected variables */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Coletadas no Fluxo
                </span>
              </div>
              {collectedVars.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2.5 bg-muted/20 rounded-lg">
                  Nenhuma variável coletada. Para criar uma, adicione um step com "Coletar resposta" ativado e defina um nome de variável.
                </p>
              ) : (
                <div className="space-y-1">
                  {collectedVars.map((v) => (
                    <div
                      key={v.name}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="font-mono text-xs shrink-0">
                          {`{{${v.name}}}`}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          Etapa #{v.stepIndex + 1}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => copyVar(v.name)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
