import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ContactImportTab, ManualContact } from "./ContactImportTab";
import { CRMContactsTab, CRMSelectedContact } from "./CRMContactsTab";
import { FollowUpCTASection } from "./FollowUpCTASection";
import { SpintaxBar } from "./SpintaxBar";
import { ScheduleFields } from "./ScheduleFields";
import { FollowUpTemplateSaveDialog } from "./FollowUpTemplateSaveDialog";
import { ArrowLeft, Eye, Save, FileDown, Megaphone, MessageSquareReply, Sparkles, Loader2, HelpCircle, Zap, ListOrdered } from "lucide-react";
import { CharCounter } from "@/components/ui/char-counter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface FollowUpCampaignFormProps {
  onBack: () => void;
  editCampaign?: any;
}

export function FollowUpCampaignForm({ onBack, editCampaign }: FollowUpCampaignFormProps) {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  const scriptRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState(editCampaign?.name || "");
  const [scriptContent, setScriptContent] = useState(editCampaign?.script_content || "");
  const [callReason, setCallReason] = useState(editCampaign?.call_reason || "");
  const [instanceId, setInstanceId] = useState(editCampaign?.instance_id || "");
  const [manualContacts, setManualContacts] = useState<ManualContact[]>([]);
  const [crmContacts, setCrmContacts] = useState<CRMSelectedContact[]>([]);

  // Schedule
  const [scheduleDate, setScheduleDate] = useState(() => {
    if (editCampaign?.scheduled_at) {
      const d = new Date(editCampaign.scheduled_at);
      return d.toISOString().split("T")[0];
    }
    return "";
  });
  const [scheduleTime, setScheduleTime] = useState(() => {
    if (editCampaign?.scheduled_at) {
      const d = new Date(editCampaign.scheduled_at);
      return d.toTimeString().slice(0, 5);
    }
    return "";
  });

  // CTA states
  const [whatsappEnabled, setWhatsappEnabled] = useState(editCampaign?.whatsapp_followup_enabled || false);
  const [whatsappText, setWhatsappText] = useState(editCampaign?.whatsapp_followup_text || "");
  const [whatsappFile, setWhatsappFile] = useState<File | null>(null);
  const [webhookEnabled, setWebhookEnabled] = useState(editCampaign?.webhook_enabled || false);
  const [flowId, setFlowId] = useState(editCampaign?.flow_id || "");
  const [callMode, setCallMode] = useState(editCampaign?.call_mode || "informativo");
  const [callingMode, setCallingMode] = useState(editCampaign?.calling_mode || "sequential");
  const [batchSize, setBatchSize] = useState(editCampaign?.batch_size || 1);
  const [isAiRewriting, setIsAiRewriting] = useState(false);

  // Template
  const [templateId, setTemplateId] = useState<string | null>(editCampaign?.template_id || null);
  const [showTemplateSaveDialog, setShowTemplateSaveDialog] = useState(false);
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);

  // Load templates for "load template" button
  const { data: templates = [] } = useQuery({
    queryKey: ["followup-templates", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("followup_templates")
        .select("*")
        .eq("organization_id", organization.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  // Fetch instances for selector
  const { data: followupInstances = [] } = useQuery({
    queryKey: ["crm-instances", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("instances_safe" as any)
        .select("id, name")
        .eq("organization_id", organization.id)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Array<{ id: string; name: string }>;
    },
    enabled: !!organization?.id,
  });

  const totalContacts = manualContacts.length + crmContacts.length;

  const previewText = scriptContent
    .replace(/\{\{NOME\}\}/g, "João Silva")
    .replace(/\{\{TELEFONE\}\}/g, "5511983226145");

  const loadTemplate = (template: any) => {
    setName(template.name);
    setScriptContent(template.script_content || "");
    setCallReason(template.call_reason || "");
    setWhatsappEnabled(template.whatsapp_followup_enabled || false);
    setWhatsappText(template.whatsapp_followup_text || "");
    setWebhookEnabled(template.webhook_enabled || false);
    setFlowId(template.flow_id || "");
    setTemplateId(template.id);
    toast.success(`Template "${template.name}" carregado`);
  };

  const saveTemplateNew = async () => {
    if (!organization?.id) return;
    const count = templates.length;
    if (count >= 5) {
      toast.error("Limite de 5 templates atingido");
      setShowTemplateSaveDialog(false);
      return;
    }
    const { error } = await supabase.from("followup_templates").insert({
      organization_id: organization.id,
      name: name.trim(),
      script_content: scriptContent,
      call_reason: callReason,
      whatsapp_followup_enabled: whatsappEnabled,
      whatsapp_followup_text: whatsappText,
      webhook_enabled: webhookEnabled,
      flow_id: flowId || null,
    });
    if (error) toast.error("Erro ao salvar template");
    else {
      toast.success("Template salvo");
      queryClient.invalidateQueries({ queryKey: ["followup-templates"] });
    }
    setShowTemplateSaveDialog(false);
  };

  const saveTemplateUpdate = async () => {
    if (!templateId) return;
    const { error } = await supabase
      .from("followup_templates")
      .update({
        name: name.trim(),
        script_content: scriptContent,
        call_reason: callReason,
        whatsapp_followup_enabled: whatsappEnabled,
        whatsapp_followup_text: whatsappText,
        webhook_enabled: webhookEnabled,
        flow_id: flowId || null,
      })
      .eq("id", templateId);
    if (error) toast.error("Erro ao atualizar template");
    else {
      toast.success("Template atualizado");
      queryClient.invalidateQueries({ queryKey: ["followup-templates"] });
    }
    setShowTemplateSaveDialog(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("Organização não encontrada");
      if (!name.trim()) throw new Error("Nome da campanha é obrigatório");
      if (!instanceId) throw new Error("Selecione uma instância de disparo");
      if (!scriptContent.trim()) throw new Error("Texto da ligação é obrigatório");
      if (!callReason.trim()) throw new Error("Motivo da ligação é obrigatório");
      if (totalContacts === 0 && !editCampaign) throw new Error("Adicione pelo menos um contato");

      // Build scheduled_at
      let scheduled_at: string | null = null;
      let status = "draft";
      if (scheduleDate && scheduleTime) {
        scheduled_at = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
        status = "scheduled";
      } else if (scheduleDate) {
        scheduled_at = new Date(`${scheduleDate}T00:00`).toISOString();
        status = "scheduled";
      }

      // Upload file if needed
      let fileUrl: string | null = editCampaign?.whatsapp_followup_file_url || null;
      let fileName: string | null = editCampaign?.whatsapp_followup_file_name || null;
      let fileSize: number | null = editCampaign?.whatsapp_followup_file_size || null;

      if (whatsappFile) {
        const filePath = `${organization.id}/followup/${crypto.randomUUID()}/${whatsappFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("message-media")
          .upload(filePath, whatsappFile);
        if (uploadError) throw new Error("Erro ao enviar arquivo: " + uploadError.message);
        // Build a storage reference URL (bucket is private; edge functions download via service role)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        fileUrl = `${supabaseUrl}/storage/v1/object/public/message-media/${filePath}`;
        fileName = whatsappFile.name;
        fileSize = whatsappFile.size;
        // Update org storage usage in real-time
        supabase.rpc("recalculate_org_storage", { p_org_id: organization.id }).then(() => {});
      }

      const campaignData: any = {
        name: name.trim(),
        script_content: scriptContent.trim(),
        call_reason: callReason.trim(),
        call_mode: callMode,
        whatsapp_followup_enabled: whatsappEnabled,
        whatsapp_followup_text: whatsappEnabled ? whatsappText : null,
        whatsapp_followup_file_url: whatsappEnabled ? fileUrl : null,
        whatsapp_followup_file_name: whatsappEnabled ? fileName : null,
        whatsapp_followup_file_size: whatsappEnabled ? fileSize : null,
        webhook_enabled: webhookEnabled,
        flow_id: webhookEnabled ? flowId || null : null,
        calling_mode: callingMode,
        batch_size: callingMode === "batch" ? batchSize : 1,
        scheduled_at,
        status: editCampaign ? (scheduled_at ? "scheduled" : editCampaign.status) : status,
        template_id: templateId,
        instance_id: instanceId || null,
      };

      if (editCampaign) {
        // Update existing campaign
        const { error } = await supabase
          .from("voice_campaigns")
          .update(campaignData)
          .eq("id", editCampaign.id);
        if (error) throw error;
        return editCampaign.id;
      }

      // Create campaign
      campaignData.organization_id = organization.id;
      campaignData.call_type = "script";
      campaignData.total_contacts = totalContacts;

      const { data: campaign, error: campaignError } = await supabase
        .from("voice_campaigns")
        .insert(campaignData)
        .select("id")
        .single();

      if (campaignError) throw campaignError;

      // Insert contacts
      const contactRows: any[] = [];
      for (const mc of manualContacts) {
        contactRows.push({
          campaign_id: campaign.id,
          contact_id: null,
          phone: mc.phone,
          name: mc.name || null,
          status: "pending",
        });
      }
      for (const cc of crmContacts) {
        contactRows.push({
          campaign_id: campaign.id,
          contact_id: cc.id,
          phone: cc.phone,
          name: cc.name || null,
          status: "pending",
        });
      }
      if (contactRows.length > 0) {
        const { error: contactsError } = await supabase.from("voice_campaign_contacts").insert(contactRows);
        if (contactsError) throw contactsError;
      }

      return campaign.id;
    },
    onSuccess: (campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["followup-campaigns"] });
      // Ask about template save
      setPendingCampaignId(campaignId);
      setShowTemplateSaveDialog(true);
    },
    onError: () => {
      toast.error("Erro ao salvar campanha");
    },
  });

  const finishSave = () => {
    setShowTemplateSaveDialog(false);
    toast.success(editCampaign ? "Campanha atualizada!" : "Campanha criada com sucesso!");
    onBack();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            {editCampaign ? "Editar Campanha" : "Nova Campanha de Follow-up"}
          </h2>
        </div>
        {/* Load template */}
        {!editCampaign && templates.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground flex-1 sm:flex-none"
              defaultValue=""
              onChange={(e) => {
                const t = templates.find((tpl: any) => tpl.id === e.target.value);
                if (t) loadTemplate(t);
              }}
            >
              <option value="" disabled>Carregar template...</option>
              {templates.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <FileDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        )}
      </div>

      {/* Instance Selector */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <Label className="text-sm font-medium">Instância de Disparo <span className="text-destructive">*</span></Label>
          <Select value={instanceId} onValueChange={setInstanceId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a instância..." />
            </SelectTrigger>
            <SelectContent>
              {followupInstances.map((inst: any) => (
                <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">WhatsApp que enviará as mensagens desta campanha</p>
        </CardContent>
      </Card>

      {/* Campaign Name + Reason */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Nome da Campanha</Label>
              <CharCounter current={name.length} max={60} />
            </div>
            <Input placeholder="Ex: Lembrete de vencimento - Janeiro" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} className="mt-1" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Motivo da Ligação</Label>
              <CharCounter current={callReason.length} max={100} />
            </div>
            <Input placeholder="Ex: Lembrete de fatura" value={callReason} onChange={(e) => setCallReason(e.target.value.slice(0, 100))} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Script */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Texto da Ligação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            ref={scriptRef}
            placeholder="Olá {{NOME}}, estamos entrando em contato para avisar que a sua fatura vence amanhã..."
            value={scriptContent}
            onChange={(e) => setScriptContent(e.target.value)}
            rows={5}
          />
          <div className="flex items-center gap-2">
            <SpintaxBar
              textareaRef={scriptRef}
              onInsert={(newValue) => setScriptContent(newValue)}
            />
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 shrink-0"
              disabled={isAiRewriting || !scriptContent.trim()}
              onClick={async () => {
                setIsAiRewriting(true);
                try {
                  const { data, error } = await supabase.functions.invoke("ai-rewrite-script", {
                    body: { text: scriptContent, reason: callReason },
                  });
                  if (error) throw error;
                  if (data?.rewritten_text) {
                    setScriptContent(data.rewritten_text);
                    toast.success("Texto ajustado com IA!");
                  } else {
                    toast.error("Não foi possível reescrever o texto");
                  }
                } catch (err: any) {
                  toast.error("Erro ao ajustar com IA");
                } finally {
                  setIsAiRewriting(false);
                }
              }}
            >
              {isAiRewriting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Ajustar com IA
            </Button>
          </div>
          {scriptContent && (
            <div className="bg-muted/30 border border-border rounded-md p-3">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Preview</span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{previewText}</p>
            </div>
          )}
          <div className="flex items-start gap-2 p-3 bg-accent/10 border border-accent/30 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-accent shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-xs text-foreground/80">
              <strong>Atenção:</strong> Não inclua frases de encerramento ou despedida no texto. A IA encerra a ligação automaticamente com uma saudação final padronizada, que aciona o desligamento da chamada.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Se o contato não tiver nome, {"{{NOME}}"} será substituído por vazio.
          </p>
        </CardContent>
      </Card>

      {/* Call Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Modo da Ligação</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={callMode} onValueChange={setCallMode} className="space-y-3">
            <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <RadioGroupItem value="informativo" id="mode-informativo" className="mt-0.5" />
              <Label htmlFor="mode-informativo" className="cursor-pointer space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Megaphone className="h-4 w-4 text-accent" />
                  Informativo
                </div>
                <p className="text-xs text-muted-foreground">A IA fala o script e encerra a ligação imediatamente, sem aguardar resposta.</p>
              </Label>
            </div>
            <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <RadioGroupItem value="acao" id="mode-acao" className="mt-0.5" />
              <Label htmlFor="mode-acao" className="cursor-pointer space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquareReply className="h-4 w-4 text-accent" />
                  Ação
                </div>
                <p className="text-xs text-muted-foreground">A IA fala o script e aguarda a resposta do cliente (até 10s). Se o cliente recusar (ex: "não quero", "não reconheço"), o CTA não será enviado. Apenas respostas positivas disparam o envio.</p>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Calling Mode */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Modo de Discagem</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  <p><strong>Sequencial:</strong> Liga para um contato por vez, aguardando cada ligação terminar antes da próxima. Mais controlado.</p>
                  <p className="mt-1"><strong>Em lote:</strong> Dispara várias ligações simultaneamente (até 10). Ideal para campanhas grandes — processa a lista muito mais rápido.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent>
          <RadioGroup value={callingMode} onValueChange={setCallingMode} className="space-y-3">
            <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <RadioGroupItem value="sequential" id="calling-sequential" className="mt-0.5" />
              <Label htmlFor="calling-sequential" className="cursor-pointer space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ListOrdered className="h-4 w-4 text-accent" />
                  Sequencial
                </div>
                <p className="text-xs text-muted-foreground">Uma ligação por vez. Mais controlado e previsível.</p>
              </Label>
            </div>
            <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <RadioGroupItem value="batch" id="calling-batch" className="mt-0.5" />
              <Label htmlFor="calling-batch" className="cursor-pointer space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-accent" />
                  Em lote (simultâneo)
                </div>
                <p className="text-xs text-muted-foreground">Dispara várias ligações ao mesmo tempo. Muito mais rápido para listas grandes.</p>
              </Label>
            </div>
          </RadioGroup>

          {callingMode === "batch" && (
            <div className="mt-4 space-y-3 p-3 bg-muted/30 border border-border rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Ligações simultâneas</Label>
                <span className="text-sm font-semibold text-accent">{batchSize}</span>
              </div>
              <Slider
                value={[batchSize]}
                onValueChange={([v]) => setBatchSize(v)}
                min={2}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>2</span>
                <span>10 (limite padrão Vapi)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                O Vapi permite até 10 ligações simultâneas por padrão. Se você aumentou o limite no painel do Vapi, poderá ajustar aqui futuramente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardContent className="pt-6">
          <ScheduleFields date={scheduleDate} onDateChange={setScheduleDate} time={scheduleTime} onTimeChange={setScheduleTime} />
        </CardContent>
      </Card>

      {/* Contacts (only for new campaigns) */}
      {!editCampaign && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Lista de Contatos ({totalContacts})</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="manual">
              <TabsList className="mb-4 w-full sm:w-auto">
                <TabsTrigger value="manual" className="text-xs sm:text-sm">Manual / Importação</TabsTrigger>
                <TabsTrigger value="crm" className="text-xs sm:text-sm">Contatos CRM</TabsTrigger>
              </TabsList>
              <TabsContent value="manual">
                <ContactImportTab contacts={manualContacts} onChange={setManualContacts} />
              </TabsContent>
              <TabsContent value="crm">
                <CRMContactsTab selected={crmContacts} onChange={setCrmContacts} manualContacts={manualContacts} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      <Card>
        <CardContent className="pt-6">
          <FollowUpCTASection
            whatsappEnabled={whatsappEnabled}
            onWhatsappEnabledChange={setWhatsappEnabled}
            whatsappText={whatsappText}
            onWhatsappTextChange={setWhatsappText}
            whatsappFile={whatsappFile}
            onWhatsappFileChange={setWhatsappFile}
            webhookEnabled={webhookEnabled}
            onWebhookEnabledChange={setWebhookEnabled}
            flowId={flowId}
            onFlowIdChange={setFlowId}
          />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end gap-2">
        {editCampaign && (
          <Button variant="outline" onClick={onBack}>
            Cancelar edição
          </Button>
        )}
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="gradient-primary text-white hover:opacity-90"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Salvando..." : editCampaign ? "Salvar Alterações" : "Salvar Campanha"}
        </Button>
      </div>

      {/* Template save dialog */}
      <FollowUpTemplateSaveDialog
        open={showTemplateSaveDialog}
        onOpenChange={setShowTemplateSaveDialog}
        hasExistingTemplate={!!templateId}
        onSaveNew={async () => {
          await saveTemplateNew();
          finishSave();
        }}
        onUpdate={async () => {
          await saveTemplateUpdate();
          finishSave();
        }}
        onSkip={finishSave}
      />
    </div>
  );
}
