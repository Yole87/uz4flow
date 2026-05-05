import { useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Webhook, Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FlowSelector } from "./FlowSelector";

const MAX_FILE_SIZE_MB = 16;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

interface FollowUpCTASectionProps {
  whatsappEnabled: boolean;
  onWhatsappEnabledChange: (v: boolean) => void;
  whatsappText: string;
  onWhatsappTextChange: (v: string) => void;
  whatsappFile: File | null;
  onWhatsappFileChange: (file: File | null) => void;
  webhookEnabled: boolean;
  onWebhookEnabledChange: (v: boolean) => void;
  flowId: string;
  onFlowIdChange: (v: string) => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FollowUpCTASection(props: FollowUpCTASectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo excede o limite de ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Tipo de arquivo não permitido. Use PDF, imagens ou planilhas.");
      return;
    }
    props.onWhatsappFileChange(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground">CTA Pós-Ligação</h4>
      <p className="text-xs text-muted-foreground">
        Configure ações que serão executadas após cada ligação, de acordo com o modo configurado.
      </p>

      {/* Option A: WhatsApp Follow-up */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Checkbox
            id="whatsapp-followup"
            checked={props.whatsappEnabled}
            onCheckedChange={(v) => props.onWhatsappEnabledChange(!!v)}
          />
          <Label htmlFor="whatsapp-followup" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <MessageSquare className="h-4 w-4 text-accent" />
            Enviar texto + arquivo pelo WhatsApp
          </Label>
        </div>

        {props.whatsappEnabled && (
          <div className="pl-7 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Mensagem de follow-up</Label>
              <Textarea
                placeholder="Conforme combinamos na ligação, segue o documento..."
                value={props.whatsappText}
                onChange={e => props.onWhatsappTextChange(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Arquivo anexo (opcional, máx {MAX_FILE_SIZE_MB}MB)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xls,.xlsx"
                className="hidden"
                onChange={handleFileSelect}
              />
              {props.whatsappFile ? (
                <div className="flex items-center gap-2 mt-1 border border-border rounded-md px-3 py-2">
                  <FileText className="h-4 w-4 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{props.whatsappFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(props.whatsappFile.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => props.onWhatsappFileChange(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="mt-1" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Selecionar arquivo
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Após a ligação, o sistema envia automaticamente a mensagem e o arquivo pelo WhatsApp do contato.
            </p>
          </div>
        )}
      </div>

      {/* Option B: Flow */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Checkbox
            id="webhook-followup"
            checked={props.webhookEnabled}
            onCheckedChange={(v) => props.onWebhookEnabledChange(!!v)}
          />
          <Label htmlFor="webhook-followup" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <Webhook className="h-4 w-4 text-accent" />
            Acionar fluxo de automação
          </Label>
        </div>

        {props.webhookEnabled && (
          <div className="pl-7 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Selecione o fluxo</Label>
              <div className="mt-1">
                <FlowSelector value={props.flowId} onChange={props.onFlowIdChange} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao final da ligação, o sistema acionará o fluxo selecionado com os dados da chamada.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
