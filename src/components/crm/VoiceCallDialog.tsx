import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Phone, Bot, FileText, Loader2, MessageSquare, Paperclip, X, Upload } from "lucide-react";
import { CharCounter } from "@/components/ui/char-counter";

interface VoiceCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
}

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

export function VoiceCallDialog({ open, onOpenChange, contactId, contactName }: VoiceCallDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [callType, setCallType] = useState<"conversational" | "script">("conversational");
  const [callReason, setCallReason] = useState("");
  const [firstMessage, setFirstMessage] = useState("Olá! Tudo bem? Estou entrando em contato para...");
  const [scriptContent, setScriptContent] = useState(
    "Olá! Estamos ligando para informar sobre uma oportunidade especial. Gostaria de receber mais detalhes pelo WhatsApp?"
  );
  const [systemPrompt, setSystemPrompt] = useState(
    "Você é um assistente de atendimento profissional e amigável. Converse naturalmente com o cliente, entenda suas necessidades e ofereça ajuda."
  );

  // WhatsApp follow-up state
  const [followupEnabled, setFollowupEnabled] = useState(false);
  const [followupText, setFollowupText] = useState("");
  const [followupFile, setFollowupFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Arquivo excede o limite de 16MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }

    setFollowupFile(file);
  };

  const removeFile = () => {
    setFollowupFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const callMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Not authenticated");

      let followupFileUrl: string | null = null;

      // Upload follow-up file if present
      if (followupEnabled && followupFile) {
        setUploadingFile(true);
        try {
          const { data: orgData } = await supabase
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", session.session.user.id)
            .limit(1)
            .single();

          if (!orgData) throw new Error("Organização não encontrada");

          const ext = followupFile.name.split(".").pop() || "bin";
          const storagePath = `${orgData.organization_id}/voice-followup/${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("contact-attachments")
            .upload(storagePath, followupFile);

          if (uploadError) throw new Error("Erro ao fazer upload do arquivo");

          // Build a storage reference URL (bucket is private; edge functions download via service role)
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          followupFileUrl = `${supabaseUrl}/storage/v1/object/public/contact-attachments/${storagePath}`;
          // Update org storage usage in real-time
          supabase.rpc("recalculate_org_storage", { p_org_id: orgData.organization_id }).then(() => {});
        } finally {
          setUploadingFile(false);
        }
      }

      const payload: Record<string, unknown> = {
        action: "create",
        contact_id: contactId,
        call_type: callType,
        call_reason: callReason,
        whatsapp_followup_enabled: followupEnabled,
        whatsapp_followup_text: followupEnabled ? followupText : null,
        whatsapp_followup_file_url: followupFileUrl,
      };

      if (callType === "script") {
        payload.script_content = scriptContent;
      } else {
        payload.first_message = firstMessage;
        payload.assistant_config = {
          firstMessage,
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }],
          },
          voice: { provider: "11labs", voiceId: "pFZP5JQG7iQjIQuC4Bku" },
          maxDurationSeconds: 300,
        };
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vapi-call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create call");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-messages"] });
      toast.success("Ligação iniciada! Acompanhe o status no chat.");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao iniciar ligação");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Phone className="h-5 w-5 text-accent" />
            Ligar com IA
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Ligar para <span className="font-medium text-foreground">{contactName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Motivo da ligação - obrigatório */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground font-medium">Motivo da ligação *</Label>
            <CharCounter current={callReason.length} max={100} />
          </div>
          <Textarea
            value={callReason}
            onChange={(e) => setCallReason(e.target.value.slice(0, 100))}
            placeholder="Ex: Follow-up sobre proposta comercial, Confirmação de agendamento..."
            className="min-h-[60px] bg-muted border-border text-foreground"
          />
        </div>

        <Tabs value={callType} onValueChange={(v) => setCallType(v as "conversational" | "script")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="conversational" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Conversacional
            </TabsTrigger>
            <TabsTrigger value="script" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Script Fixo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversational" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-foreground">Primeira mensagem</Label>
              <Textarea
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                placeholder="O que a IA dirá ao cliente atender..."
                className="min-h-[80px] bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Instruções da IA (System Prompt)</Label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Como a IA deve se comportar..."
                className="min-h-[100px] bg-muted border-border text-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              💡 A IA conversará naturalmente com o cliente. Custo estimado: ~$0.15-0.22/min
            </p>
          </TabsContent>

          <TabsContent value="script" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-foreground">Texto do Script</Label>
              <Textarea
                value={scriptContent}
                onChange={(e) => setScriptContent(e.target.value)}
                placeholder="Mensagem que será lida ao cliente..."
                className="min-h-[120px] bg-muted border-border text-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              💡 O script será lido por voz e a IA detectará respostas simples. Custo estimado: ~$0.07-0.12/min
            </p>
          </TabsContent>
        </Tabs>

        {/* WhatsApp Follow-up Section */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="h-4 w-4 text-accent shrink-0" />
              <Label className="text-foreground font-medium text-sm">
                Enviar WhatsApp se o cliente aceitar?
              </Label>
            </div>
            <Switch
              checked={followupEnabled}
              onCheckedChange={setFollowupEnabled}
            />
          </div>

          {followupEnabled && (
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">
                  Mensagem a ser enviada quando o cliente aceitar durante a ligação
                </Label>
                <Textarea
                  value={followupText}
                  onChange={(e) => setFollowupText(e.target.value)}
                  placeholder="Ex: Olá! Conforme conversamos, segue o material sobre nossa proposta..."
                  className="min-h-[80px] bg-muted border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">
                  Anexar arquivo (opcional, máx. 16MB)
                </Label>
                
                {followupFile ? (
                  <div className="flex items-center gap-2 bg-muted rounded-md p-2 text-sm">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate flex-1">{followupFile.name}</span>
                    <span className="text-muted-foreground text-xs shrink-0">
                      {(followupFile.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={removeFile}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed border-border text-muted-foreground"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar arquivo
                  </Button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                💡 A IA analisará a transcrição da ligação. Se o cliente demonstrar consentimento (ex: "sim", "pode enviar", "concordo"), a mensagem e o arquivo serão enviados automaticamente pelo WhatsApp.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto border-border text-muted-foreground">
            Cancelar
          </Button>
          <Button
            onClick={() => callMutation.mutate()}
            disabled={callMutation.isPending || uploadingFile || !callReason.trim() || (followupEnabled && !followupText.trim())}
            className="w-full sm:w-auto gradient-primary text-white hover:opacity-90"
          >
            {callMutation.isPending || uploadingFile ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Phone className="h-4 w-4 mr-2" />
            )}
            Iniciar Ligação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
