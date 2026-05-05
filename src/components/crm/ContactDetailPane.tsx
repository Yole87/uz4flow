import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  X,
  Archive,
  ChevronUp,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Sheet,
  Trash2,
  Download,
  Loader2,
  Phone,
  PhoneOff,
  Clock,
  Bot,
  User as UserIcon,
  Play,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VoiceCallDialog } from "@/components/crm/VoiceCallDialog";
import { SmartLabelPicker } from "@/components/crm/SmartLabelPicker";
import { SmartLabelList } from "@/components/crm/SmartLabelBadge";
import { useSmartLabels } from "@/hooks/useSmartLabels";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { formatPhoneInput, PHONE_PLACEHOLDER } from "@/lib/phoneFormat";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

const MAX_FILES_PER_CONTACT = 5;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

const updateContactSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

type UpdateContactValues = z.infer<typeof updateContactSchema>;

interface ContactDetailPaneProps {
  contactId: string;
  onClose: () => void;
}

export function ContactDetailPane({ contactId, onClose }: ContactDetailPaneProps) {
  const [activeTab, setActiveTab] = useState<"general" | "timeline">("general");
  const [isInfoOpen, setIsInfoOpen] = useState(true);
  const [comment, setComment] = useState("");
  const [showVoiceCallDialog, setShowVoiceCallDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: organization } = useUserOrganization();
  const { labels: smartLabels } = useSmartLabels();

  // Fetch contact
  const { data: contact } = useQuery({
    queryKey: ["crm-contact-detail", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, instances:instance_id(name, channel)")
        .eq("id", contactId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch Instagram lead identity (handle/name) when applicable
  const channel = (contact as any)?.channel || (contact as any)?.instances?.channel || "whatsapp";
  const isInstagram = channel === "instagram";
  const igScopedId = (contact as any)?.ig_user_scoped_id as string | null | undefined;

  const { data: igLead } = useQuery({
    queryKey: ["crm-contact-ig-lead", organization?.id, igScopedId],
    queryFn: async () => {
      if (!organization?.id || !igScopedId) return null;
      const { data, error } = await supabase
        .from("instagram_leads")
        .select("ig_handle, ig_name")
        .eq("organization_id", organization.id)
        .eq("ig_user_scoped_id", igScopedId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id && !!igScopedId && isInstagram,
  });

  const igMeta = (((contact as any)?.metadata || {}) as Record<string, string | undefined>);
  const igHandle = igLead?.ig_handle || igMeta.username || igMeta.ig_username || null;
  const igName = igLead?.ig_name || null;

  // Fetch notes/timeline
  const { data: notes } = useQuery({
    queryKey: ["crm-contact-notes", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_notes")
        .select("*, profiles:author_user_id(full_name)")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch voice call history
  const { data: voiceCalls } = useQuery({
    queryKey: ["crm-contact-voice-calls", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_calls")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch attachments
  const { data: attachments } = useQuery({
    queryKey: ["crm-contact-attachments", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_attachments")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<UpdateContactValues>({
    resolver: zodResolver(updateContactSchema),
    values: {
      name: contact?.name || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
    },
  });

  // Update contact mutation
  const updateMutation = useMutation({
    mutationFn: async (values: UpdateContactValues) => {
      const { error } = await supabase
        .from("contacts")
        .update({
          name: values.name,
          email: values.email || null,
          phone: values.phone || "",
        })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-detail", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-all-contacts"] });
      toast.success("Registro atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar registro"),
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      if (!organization?.id) throw new Error("Carregando organização...");
      const { error } = await supabase.from("contact_notes").insert({
        contact_id: contactId,
        organization_id: organization.id,
        author_user_id: user.id,
        content,
        note_type: "comment",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-notes", contactId] });
      setComment("");
      toast.success("Comentário adicionado!");
    },
    onError: () => toast.error("Erro ao adicionar comentário"),
  });

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organization?.id) throw new Error("Não autenticado");

      // Check file count
      if ((attachments?.length ?? 0) >= MAX_FILES_PER_CONTACT) {
        throw new Error(`Limite de ${MAX_FILES_PER_CONTACT} arquivos atingido`);
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`Arquivo excede o limite de ${MAX_FILE_SIZE_MB}MB`);
      }

      // Check mime type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error("Tipo de arquivo não permitido. Apenas PDF, imagens e planilhas.");
      }

      const ext = file.name.split(".").pop();
      const storagePath = `${organization.id}/${contactId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("contact-attachments")
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("contact_attachments").insert({
        contact_id: contactId,
        organization_id: organization.id,
        uploaded_by: user.id,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_path: storagePath,
      });
      if (dbError) throw dbError;
      // Update org storage usage in real-time
      supabase.rpc("recalculate_org_storage", { p_org_id: organization.id }).then(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-attachments", contactId] });
      toast.success("Arquivo anexado!");
    },
    onError: () => toast.error("Erro ao anexar arquivo"),
  });

  // Delete attachment
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachment: { id: string; storage_path: string }) => {
      await supabase.storage.from("contact-attachments").remove([attachment.storage_path]);
      const { error } = await supabase.from("contact_attachments").delete().eq("id", attachment.id);
      if (error) throw error;
      if (organization?.id) {
        supabase.rpc("recalculate_org_storage", { p_org_id: organization.id }).then(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-attachments", contactId] });
      toast.success("Arquivo removido!");
    },
    onError: () => toast.error("Erro ao remover arquivo"),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (storagePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("contact-attachments")
      .download(storagePath);
    if (error || !data) { toast.error("Erro ao baixar arquivo"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-primary" />;
    if (mimeType === "application/pdf") return <FileText className="h-4 w-4 text-destructive" />;
    return <Sheet className="h-4 w-4 text-accent" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const displayName = contact?.name || "Contato";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab("general")}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              activeTab === "general"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Geral
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              activeTab === "timeline"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Linha do tempo
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              supabase
                .from("contacts")
                .update({ is_archived: true } as any)
                .eq("id", contactId)
                .then(({ error }) => {
                  if (error) {
                    toast.error("Erro ao arquivar contato");
                  } else {
                    toast.success("Contato arquivado!");
                    queryClient.invalidateQueries({ queryKey: ["crm-all-contacts"] });
                    onClose();
                  }
                });
            }}
          >
            <Archive className="h-3.5 w-3.5 mr-1" />
            Arquivar
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Smart Labels row */}
      <div className="px-4 py-2 border-b border-border bg-muted/20 flex items-center gap-2 flex-wrap">
        <SmartLabelList
          labelKeys={(contact as any)?.smart_label_keys || []}
          allLabels={smartLabels}
          size="sm"
          max={6}
          className="flex-1 min-w-0"
        />
        <SmartLabelPicker
          contactId={contactId}
          selectedKeys={(contact as any)?.smart_label_keys || []}
          align="end"
        />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {activeTab === "general" ? (
          <div className="flex flex-col lg:flex-row gap-0 lg:gap-0">
            {/* Left - Form */}
            <div className="flex-1 p-4 lg:p-6">
              <Collapsible open={isInfoOpen} onOpenChange={setIsInfoOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Informações gerais</h3>
                  <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform ${isInfoOpen ? "" : "rotate-180"}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {/* Instagram identity block */}
                  {isInstagram && (
                    <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className="h-5 shrink-0 border-accent/30 bg-accent/10 px-1.5 text-[9px] font-semibold text-accent"
                        >
                          INSTAGRAM DM
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Contato originado em mensagem direta
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                            @ do perfil
                          </p>
                          <p className="text-sm font-medium text-foreground truncate">
                            {igHandle ? `@${igHandle}` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                            Nome no Instagram
                          </p>
                          <p className="text-sm font-medium text-foreground truncate">
                            {igName || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">* Nome</FormLabel>
                              <FormControl>
                                <Input {...field} className="bg-background border-border" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">E-mail</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="email@exemplo.com.br" className="bg-background border-border" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      {!isInstagram && (
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem className="max-w-xs">
                              <FormLabel className="text-xs text-muted-foreground">Telefone</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={PHONE_PLACEHOLDER}
                                  value={field.value}
                                  onChange={(e) => field.onChange(formatPhoneInput(e.target.value))}
                                  className="bg-background border-border"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <div className="flex justify-center pt-2">
                        <Button type="submit" disabled={updateMutation.isPending} size="sm">
                          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                          Atualizar Registro
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Right sidebar - Actions */}
            <div className="w-full lg:w-56 border-t lg:border-t-0 lg:border-l border-border p-4 lg:p-5">
              <h4 className="text-sm font-semibold text-foreground mb-3">Ações</h4>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xls,.xlsx,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="text-xs w-full justify-start mb-2 opacity-50 cursor-not-allowed"
                    >
                      <Phone className="h-3.5 w-3.5 mr-1.5" />
                      Ligar IA
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Função em construção</TooltipContent>
              </Tooltip>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending || (attachments?.length ?? 0) >= MAX_FILES_PER_CONTACT}
                className="text-xs w-full justify-start"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                )}
                Anexar
              </Button>
              <p className="text-xs text-muted-foreground mt-1.5">
                PDF, imagens ou planilhas. Máx {MAX_FILES_PER_CONTACT} arquivos, {MAX_FILE_SIZE_MB}MB cada.
              </p>

              {/* Attached files */}
              {attachments && attachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Arquivos ({attachments.length}/{MAX_FILES_PER_CONTACT})
                  </p>
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group">
                      {getFileIcon(att.mime_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate">{att.file_name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(att.file_size)}</p>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDownload(att.storage_path, att.file_name)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => deleteAttachmentMutation.mutate({ id: att.id, storage_path: att.storage_path })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Timeline tab */
          <div className="p-4 lg:p-6 space-y-4">
            {/* Comment input */}
            <div className="border border-border rounded-lg overflow-hidden">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Novo comentário"
                className="border-0 min-h-[100px] resize-none focus-visible:ring-0 bg-background"
              />
              <div className="flex justify-end p-2 border-t border-border bg-muted/30">
                <Button
                  size="sm"
                  onClick={() => comment.trim() && addCommentMutation.mutate(comment.trim())}
                  disabled={!comment.trim() || !organization?.id || addCommentMutation.isPending}
                >
                  {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Comentar
                </Button>
              </div>
            </div>

            {/* Voice Call History */}
            {voiceCalls && voiceCalls.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4 text-accent" />
                  Histórico de Ligações ({voiceCalls.length})
                </h4>
                {voiceCalls.map((call) => {
                  const duration = call.duration_seconds || 0;
                  const hours = Math.floor(duration / 3600);
                  const minutes = Math.floor((duration % 3600) / 60);
                  const seconds = duration % 60;
                  const durationStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
                  const isSuccess = call.status === "completed";
                  const transcript = call.transcript;

                  return (
                    <div key={call.id} className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
                      {/* Call header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded-full ${isSuccess ? "bg-accent/20" : "bg-destructive/20"}`}>
                            {isSuccess ? (
                              <Phone className="h-3 w-3 text-accent" />
                            ) : (
                              <PhoneOff className="h-3 w-3 text-destructive" />
                            )}
                          </div>
                          <span className="text-xs font-medium text-foreground">
                            {call.call_type === "script" ? "Script" : "Conversacional"}
                          </span>
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {call.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {durationStr}
                        </div>
                      </div>

                      {/* Date */}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(call.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>

                      {/* Call reason */}
                      {call.call_reason && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Motivo:</span> {call.call_reason}
                        </p>
                      )}

                      {/* Summary */}
                      {call.summary && (
                        <p className="text-xs text-muted-foreground">{call.summary}</p>
                      )}

                      {/* Customer action */}
                      {call.customer_action && (
                        <p className="text-xs text-accent font-medium">
                          ✅ Ação: {call.customer_action}
                        </p>
                      )}

                      {/* Recording */}
                      {call.recording_url && (
                        <a
                          href={call.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-accent hover:underline"
                        >
                          <Play className="h-3 w-3" />
                          Ouvir gravação
                        </a>
                      )}

                      {/* Transcript */}
                      {transcript && (
                        <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Transcrição
                          </p>
                          <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                            {(() => {
                              try {
                                const parsed = JSON.parse(transcript);
                                if (Array.isArray(parsed)) {
                                  return parsed.map((entry: { role: string; content: string; time?: number }, i: number) => (
                                    <div key={i} className="flex gap-2">
                                      <div className={`shrink-0 mt-0.5 p-0.5 rounded-full ${
                                        entry.role === "customer" ? "bg-primary/20" : "bg-accent/20"
                                      }`}>
                                        {entry.role === "customer" ? (
                                          <UserIcon className="h-2.5 w-2.5 text-primary" />
                                        ) : (
                                          <Bot className="h-2.5 w-2.5 text-accent" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <span className={`font-medium text-xs ${
                                          entry.role === "customer" ? "text-primary" : "text-accent"
                                        }`}>
                                          {entry.role === "customer" ? (contact?.name || "Cliente") : "IA"}
                                          {entry.time != null && (
                                            <span className="text-muted-foreground ml-1">
                                              {Math.floor(entry.time / 60)}:{String(Math.floor(entry.time % 60)).padStart(2, "0")}
                                            </span>
                                          )}
                                        </span>
                                        <p className="text-muted-foreground">{entry.content}</p>
                                      </div>
                                    </div>
                                  ));
                                }
                              } catch {
                                // Plain text transcript
                              }
                              return <p className="text-muted-foreground whitespace-pre-wrap">{transcript}</p>;
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Timeline entries */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Comentários</h4>
              {notes?.map((note) => {
                const authorName = (note.profiles as any)?.full_name || "Usuário";
                const noteInitials = authorName.slice(0, 1).toUpperCase();
                return (
                  <div key={note.id} className="flex gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                        {noteInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-foreground">{authorName}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.created_at), "dd/MM/yyyy, HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="mt-1.5 p-3 rounded-lg bg-muted/50 border border-border">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {(!notes || notes.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
              )}
            </div>
          </div>
        )}
      </ScrollArea>

      {showVoiceCallDialog && (
        <VoiceCallDialog
          contactId={contactId}
          contactName={displayName}
          open={showVoiceCallDialog}
          onOpenChange={setShowVoiceCallDialog}
        />
      )}
    </div>
  );
}
