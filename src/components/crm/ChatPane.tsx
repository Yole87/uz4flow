import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isToday, isYesterday, differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageBubble } from "./MessageBubble";
import { ChatHeaderMenu } from "./ChatHeaderMenu";
import { EmojiPicker } from "./EmojiPicker";
import { ActiveCallBanner } from "./ActiveCallBanner";
import { MessageSelectionBar } from "./MessageSelectionBar";
import { TextSuggestionBar } from "./TextSuggestionBar";
import { ForwardMessageDialog } from "./ForwardMessageDialog";
import { useActiveVoiceCall } from "@/hooks/useActiveVoiceCall";
import { useCRMRealtime } from "@/hooks/useCRMRealtime";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Paperclip, 
  Smile, 
  Mic, 
  Search,
  PanelRightClose,
  PanelRightOpen,
  MessageSquare,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Ban,
  X,
  Loader2,
  Phone,
  Wand2,
  Zap,
  CalendarPlus,
  Bell,
  BellPlus,
  Clock,
  Workflow
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useStorageUsage } from "@/hooks/useStorageUsage";
import { QuickReplyPopover } from "./QuickReplyPopover";
import { QuickReplyManager } from "./QuickReplyManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScheduleEventDialog } from "./ScheduleEventDialog";
import { MetaWindowBar } from "./MetaWindowBar";
import { MetaTemplateSelector } from "./MetaTemplateSelector";
import { useMetaWindow } from "@/hooks/useMetaWindow";
import { IgWindowBar } from "./IgWindowBar";
import { ChannelIcon } from "@/components/icons/ChannelIcon";
import { ReminderDialog } from "./ReminderDialog";
import { RemindersBell } from "./RemindersBell";
import { QuickReplyShortcuts } from "./QuickReplyShortcuts";
import { TriggerFlowDialog } from "./TriggerFlowDialog";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";
import { ScheduledMessagesList } from "./ScheduledMessagesList";
import { useScheduledMessages } from "@/hooks/useScheduledMessages";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import type { QuickReply } from "@/hooks/useQuickReplies";
import type { Database } from "@/integrations/supabase/types";

type Message = Database["public"]["Tables"]["messages"]["Row"];

interface ChatPaneProps {
  contactId: string | null;
  conversationId?: string | null;
  onToggleInspector: () => void;
  showInspector: boolean;
  isMobile?: boolean;
  onBack?: () => void;
}

export function ChatPane({ 
  contactId, 
  conversationId: propConversationId,
  onToggleInspector, 
  showInspector, 
  isMobile = false,
  onBack 
}: ChatPaneProps) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [attachedFile, setAttachedFile] = useState<{ name: string; base64: string; mimeType: string } | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  
  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  // Message selection state
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const selectionMode = selectedMessageIds.size > 0;
  const actualSelectedCount = Array.from(selectedMessageIds).filter(id => id !== "__selection_mode_active__").length;

  // AI suggestions state
  const [aiSuggestEnabled, setAiSuggestEnabled] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);

  // Quick replies state
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [quickReplyFilter, setQuickReplyFilter] = useState("");

  // Schedule event state
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Reminder state
  const [reminderOpen, setReminderOpen] = useState(false);

  // Trigger flow dialog state
  const [triggerFlowOpen, setTriggerFlowOpen] = useState(false);

  // Quick replies manager dialog state
  const [quickReplyManagerOpen, setQuickReplyManagerOpen] = useState(false);

  // Scheduled messages state
  const [scheduleMessageOpen, setScheduleMessageOpen] = useState(false);
  const [scheduledListOpen, setScheduledListOpen] = useState(false);

  const { data: userOrg } = useUserOrganization();

  // Storage usage
  const { isAtLimit: storageAtLimit, isNearLimit: storageNearLimit } = useStorageUsage();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch contact info with instance - use propConversationId for isolation
  const { data: contactData, isLoading: contactLoading } = useQuery({
    queryKey: ["crm-contact", contactId, propConversationId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data: contact, error } = await supabase
        .from("contacts").select("*").eq("id", contactId).single();
      if (error) throw error;
      
      let convQuery = supabase
        .from("conversations")
        .select(`id, instance_id, channel, dm_window_expires_at, instance:instances(id, name, phone_number, provider, channel, instagram_account_id)`);
      
      if (propConversationId) {
        convQuery = convQuery.eq("id", propConversationId);
      } else {
        convQuery = convQuery.eq("contact_id", contactId)
          .order("created_at", { ascending: false })
          .limit(1);
      }
      
      const { data: conversation } = await convQuery.maybeSingle();
      return {
        ...contact,
        instance: conversation?.instance as { id: string; name: string; phone_number: string | null; provider: string | null; channel?: string | null; instagram_account_id?: string | null } | null,
        channel: (conversation as any)?.channel || null,
        dm_window_expires_at: (conversation as any)?.dm_window_expires_at || null,
        resolvedConversationId: conversation?.id || null,
      };
    },
    enabled: !!contactId,
  });
  
  const contact = contactData;

  // Use resolved conversation ID for message isolation
  const resolvedConvId = propConversationId || contactData?.resolvedConversationId;

  // Scheduled messages for this conversation
  const { messages: scheduledMessages } = useScheduledMessages(resolvedConvId);
  const pendingScheduledCount = scheduledMessages.filter((m) => m.status === "pending").length;

  // Meta window state
  const instanceProvider = contact?.instance?.provider || null;
  const isInstagramChannel = (contact?.channel === "instagram") || (contact?.instance?.channel === "instagram");
  const igDmWindowExpiresAt = contact?.dm_window_expires_at as string | null | undefined;
  const metaWindow = useMetaWindow(resolvedConvId, instanceProvider);

  // Fetch conversation and messages (last 3 days only) - STRICTLY isolated by conversationId
  // CRITICAL: when propConversationId is provided, NEVER fall back to "latest by contact"
  // to avoid cross-conversation leakage on contacts with multiple channels (WA + IG).
  const { data: conversationData, isLoading: messagesLoading } = useQuery({
    queryKey: ["crm-messages", contactId, resolvedConvId],
    queryFn: async () => {
      if (!contactId) return null;

      let conv;
      if (resolvedConvId) {
        const { data, error } = await supabase
          .from("conversations").select("*").eq("id", resolvedConvId).single();
        if (error && error.code !== "PGRST116") throw error;
        conv = data;
      } else if (!propConversationId) {
        // Only fall back to "latest" when caller did NOT specify a conversation
        const { data, error } = await supabase
          .from("conversations").select("*").eq("contact_id", contactId)
          .order("created_at", { ascending: false }).limit(1).single();
        if (error && error.code !== "PGRST116") throw error;
        conv = data;
      }
      if (!conv) return { conversation: null, messages: [] };

      if (conv.unread_count > 0) {
        await supabase.from("conversations").update({ unread_count: 0 }).eq("id", conv.id);
        conv.unread_count = 0;
      }

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data: messages, error: msgError } = await supabase
        .from("messages").select("*").eq("conversation_id", conv.id)
        .gte("timestamp", threeDaysAgo).order("timestamp", { ascending: true });
      if (msgError) throw msgError;
      return { conversation: conv, messages: messages || [] };
    },
    // Wait for resolved conversation id when caller passed one
    enabled: !!contactId && (!propConversationId || !!resolvedConvId),
    refetchInterval: 5000,
  });

  // Meta window expired: either window closed or new contact with no messages on meta_official
  const isMetaWindowExpired = metaWindow.isMetaInstance && !metaWindow.isLoading && 
    (!metaWindow.isOpen || !conversationData?.conversation?.last_message_at);

  // Instagram HUMAN_AGENT mode (allows responses up to 7d outside the 24h window)
  const [igHumanAgentMode, setIgHumanAgentMode] = useState(false);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { messageText: string; arquivo?: string; content_type?: string; file_name?: string }) => {
      if (!contactId || !conversationData?.conversation) throw new Error("No conversation available");
      const { data, error } = await supabase.functions.invoke("crm-send-message", {
        body: {
          conversation_id: conversationData.conversation.id,
          message: payload.messageText,
          arquivo: payload.arquivo,
          content_type: payload.content_type,
          file_name: payload.file_name,
          ig_human_agent: isInstagramChannel && igHumanAgentMode ? true : undefined,
        },
      });
      if (error) throw error;
      if (data?.success === false || data?.error) {
        throw new Error(data.error || "Erro desconhecido ao enviar mensagem.");
      }
      return data.message;
    },
    onSuccess: (newMessage) => {
      if (newMessage) {
        queryClient.setQueryData(["crm-messages", contactId, resolvedConvId], (old: typeof conversationData) => {
          if (!old) return old;
          return { ...old, messages: [...old.messages, newMessage] };
        });
      }
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      // Invalidate ALL message queries for this contact (any conversation) to keep cache fresh
      queryClient.invalidateQueries({ queryKey: ["crm-messages", contactId], exact: false });
      queryClient.invalidateQueries({ queryKey: ["storage-usage"] });
    },
    onError: (err: any) => {
      const raw = String(err?.message || err || "").toLowerCase();

      // Meta: janela de 24h expirada — exige template aprovado
      const isWindowExpired =
        raw.includes("re-engagement message") ||
        raw.includes("outside the allowed window") ||
        raw.includes("131047") ||
        raw.includes("janela") && raw.includes("expir");

      // Meta: token inválido / sessão expirada
      const isTokenError =
        raw.includes("session has expired") ||
        raw.includes("validating access token") ||
        raw.includes("access token") ||
        raw.includes("oauthexception") ||
        raw.includes("190");

      // Instagram: fora da janela de 24h
      const isIgWindow =
        raw.includes("messages can only be sent") ||
        raw.includes("(#10)") ||
        raw.includes("human_agent");

      if (isWindowExpired) {
        toast.error("Janela de 24h expirada", {
          description:
            "A Meta exige um template aprovado para reabrir a conversa. Selecione um template no seletor abaixo do campo de mensagem.",
          duration: 9000,
        });
      } else if (isTokenError) {
        toast.error("Token Meta inválido ou expirado", {
          description:
            "Atualize o Access Token em Configurações → Instância para continuar enviando mensagens.",
          duration: 9000,
        });
      } else if (isIgWindow) {
        toast.error("Fora da janela do Instagram", {
          description:
            "O Instagram permite respostas em até 24h após a última mensagem do contato. Aguarde uma nova interação ou ative o modo Atendimento Humano (requer aprovação Meta).",
          duration: 9000,
        });
      } else {
        toast.error("Erro ao enviar mensagem", {
          description: err?.message || "Tente novamente em alguns instantes.",
          duration: 6000,
        });
      }
    },
    onSettled: () => {
      setMessage("");
      setAttachedFile(null);
      setSuggestions([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "40px";
      }
    },
  });

  // Delete messages mutation
  const deleteMessagesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("messages").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-messages", contactId], exact: false });
      setSelectedMessageIds(new Set());
      toast.success("Mensagens apagadas");
    },
    onError: () => toast.error("Erro ao apagar mensagens"),
  });

  // Realtime is centralized at CRMLayout (single channel per org) to avoid
  // duplicate channel-name collisions causing CHANNEL_ERROR/reconnect loops.
  const { data: activeCall } = useActiveVoiceCall(contactId);

  useEffect(() => {
    if (contactId) {
      const timer = setTimeout(() => queryClient.invalidateQueries({ queryKey: ["crm-conversations"] }), 100);
      return () => clearTimeout(timer);
    }
  }, [contactId, queryClient]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [conversationData?.messages, scrollToBottom]);

  // Search logic
  useEffect(() => {
    if (!searchQuery.trim() || !conversationData?.messages) {
      setSearchResults([]); setCurrentSearchIndex(0); return;
    }
    const query = searchQuery.toLowerCase();
    const indices = conversationData.messages
      .map((msg, i) => (msg.content?.toLowerCase().includes(query) ? i : -1))
      .filter(i => i !== -1);
    setSearchResults(indices);
    setCurrentSearchIndex(indices.length > 0 ? indices.length - 1 : 0);
  }, [searchQuery, conversationData?.messages]);

  useEffect(() => {
    if (searchResults.length > 0) {
      const el = document.getElementById(`msg-${searchResults[currentSearchIndex]}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentSearchIndex, searchResults]);

  // AI suggestions debounce
  useEffect(() => {
    if (!aiSuggestEnabled || !message.trim() || message.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ai-text-suggest", {
          body: { text: message.trim() },
        });
        if (!error && data?.suggestions) {
          setSuggestions(data.suggestions);
        }
      } catch {
        // silently fail
      } finally {
        setSuggestLoading(false);
      }
    }, 500);
    return () => { if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current); };
  }, [message, aiSuggestEnabled]);

  // Clear selection when contact changes
  useEffect(() => { setSelectedMessageIds(new Set()); }, [contactId]);

  // --- Handlers ---
  const handleSendMessage = () => {
    const trimmed = message.trim();
    if (!trimmed && !attachedFile) return;
    const category = attachedFile ? getMimeCategory(attachedFile.mimeType) : undefined;
    const payload = {
      messageText: trimmed,
      arquivo: attachedFile?.base64,
      content_type: category,
      file_name: attachedFile?.name,
    };
    sendMessageMutation.mutate(payload);
  };

  // Send a quick reply: text inserts into input, media is fetched + sent immediately
  const handleQuickReplySelect = async (qr: QuickReply) => {
    if (qr.media_type === "text") {
      setMessage(qr.content || "");
      setQuickReplyOpen(false);
      setQuickReplyFilter("");
      textareaRef.current?.focus();
      return;
    }

    if (!qr.media_url || !conversationData?.conversation) {
      toast.error("Resposta rápida inválida");
      return;
    }

    try {
      toast.loading("Enviando mídia...", { id: "qr-send" });
      const res = await fetch(qr.media_url);
      if (!res.ok) throw new Error("Falha ao baixar mídia");
      const blob = await res.blob();
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const mime = qr.mime_type || blob.type || "application/octet-stream";
      const category = getMimeCategory(mime);

      sendMessageMutation.mutate({
        messageText: "",
        arquivo: base64,
        content_type: category,
        file_name: qr.file_name || undefined,
      });
      toast.dismiss("qr-send");
      setQuickReplyOpen(false);
      setQuickReplyFilter("");
    } catch (err: any) {
      toast.dismiss("qr-send");
      toast.error("Erro ao enviar resposta rápida", { description: err?.message });
    }
  };

  const getMimeCategory = (mime: string): string => {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    // Only OGG Opus is a valid WhatsApp voice message
    // Other audio formats (MP3, WAV, M4A) must be sent as document
    if (mime.startsWith("audio/")) {
      if (mime.includes("ogg")) return "audio";
      return "document";
    }
    return "document";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast.error("Arquivo muito grande. Limite: 16MB"); return; }
    if (isInstagramChannel) {
      const cat = getMimeCategory(file.type);
      if (cat === "document") {
        toast.error("Instagram não suporta documentos/PDF. Use imagem, áudio ou vídeo.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }
    const reader = new FileReader();
    reader.onload = () => setAttachedFile({ name: file.name, base64: reader.result as string, mimeType: file.type });
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEmojiClick = (emoji: string) => { setMessage(prev => prev + emoji); setEmojiOpen(false); };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeTypes = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"];
      const supportedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || "";
      const recorder = new MediaRecorder(stream, supportedMime ? { mimeType: supportedMime } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true); setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch { toast.error("Não foi possível acessar o microfone"); }
  };

  const sendRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach(t => t.stop());
      const actualMime = recorder.mimeType || "audio/webm;codecs=opus";
      const blob = new Blob(audioChunksRef.current, { type: actualMime });
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        sendMessageMutation.mutate({ messageText: "", arquivo: base64, content_type: "audio" });
      };
      reader.readAsDataURL(blob);
      setIsRecording(false); setRecordingDuration(0);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
    recorder.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false); setRecordingDuration(0);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const toggleSearch = () => {
    setSearchOpen(prev => !prev);
    if (searchOpen) { setSearchQuery(""); setSearchResults([]); }
    else setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  // Message selection handlers
  const toggleMessageSelect = (msgId: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  };

  const handleCopyMessages = () => {
    const realIds = new Set(Array.from(selectedMessageIds).filter(id => id !== "__selection_mode_active__"));
    const msgs = conversationData?.messages.filter(m => realIds.has(m.id)) || [];
    const text = msgs.map(m => m.content || "").filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Mensagens copiadas");
    setSelectedMessageIds(new Set());
  };

  const handleDeleteMessages = () => {
    const realIds = Array.from(selectedMessageIds).filter(id => id !== "__selection_mode_active__");
    if (realIds.length === 0) { toast.info("Selecione ao menos uma mensagem"); return; }
    deleteMessagesMutation.mutate(realIds);
  };

  const handleForwardMessages = () => {
    const realIds = Array.from(selectedMessageIds).filter(id => id !== "__selection_mode_active__");
    if (realIds.length === 0) { toast.info("Selecione ao menos uma mensagem"); return; }
    setForwardOpen(true);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    // The suggestion completes the current text
    const words = message.trim().split(" ");
    const lastWord = words[words.length - 1];
    // If suggestion starts with the last word fragment, replace it
    if (suggestion.toLowerCase().startsWith(lastWord.toLowerCase().slice(-3))) {
      setMessage(words.slice(0, -1).join(" ") + (words.length > 1 ? " " : "") + suggestion + " ");
    } else {
      setMessage(message.trimEnd() + " " + suggestion + " ");
    }
    setSuggestions([]);
  };

  const displayName = contact?.name || contact?.phone || "Contato";
  const initials = displayName.slice(0, 2).toUpperCase();

  if (!contactId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-muted-foreground px-4">
        <div className="bg-muted rounded-full p-6 mb-4">
          <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-accent/50" />
        </div>
        <h2 className="text-lg sm:text-xl font-medium text-foreground mb-2 text-center">CRM</h2>
        <p className="text-sm text-center max-w-sm">
          Selecione uma conversa para começar a interagir com seus contatos
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 border-b border-border bg-background">
        {isMobile && onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0" aria-label="Voltar">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {contactLoading ? (
          <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-muted" />
        ) : (
          <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
            <AvatarImage src={contact?.avatar_url || undefined} />
            <AvatarFallback className="bg-accent text-accent-foreground text-xs sm:text-sm">{initials}</AvatarFallback>
          </Avatar>
        )}
        
        <div className="flex-1 min-w-0">
          {contactLoading ? (
            <Skeleton className="h-5 w-24 sm:w-32 bg-muted" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm sm:text-base text-foreground truncate">{displayName}</h3>
                {activeCall && (
                  <Badge className="bg-accent/20 text-accent border-accent/30 text-xs h-5 shrink-0">
                    <Phone className="h-2.5 w-2.5 mr-1" />
                    Em Ligação
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                {contact?.instance ? (
                  <>
                    <ChannelIcon
                      channel={(contact.instance.channel as string) || (isInstagramChannel ? "instagram" : "whatsapp")}
                      size={12}
                    />
                    <span className="truncate">
                      via {contact.instance.name}
                      {contact.instance.phone_number ? ` (+${contact.instance.phone_number.substring(0, 4)}...)` : ''}
                    </span>
                  </>
                ) : 'online'}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <RemindersBell />
          <Button
            variant="ghost" size="icon" onClick={() => setQuickReplyManagerOpen(true)}
            className="hidden sm:flex h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Gerenciar respostas rápidas"
          >
            <Zap className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost" size="icon" onClick={() => setReminderOpen(true)}
            className="hidden sm:flex h-9 w-9 text-muted-foreground hover:text-accent hover:bg-muted"
            title="Criar lembrete sobre este contato"
            disabled={!contactId}
          >
            <BellPlus className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost" size="icon" onClick={() => setScheduleMessageOpen(true)}
            className="hidden sm:flex h-9 w-9 text-muted-foreground hover:text-accent hover:bg-muted relative"
            title="Agendar mensagem"
            disabled={!resolvedConvId}
          >
            <Clock className="h-5 w-5" />
            {pendingScheduledCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center">
                {pendingScheduledCount}
              </span>
            )}
          </Button>
          <Button
            variant="ghost" size="icon" onClick={() => setTriggerFlowOpen(true)}
            className="hidden sm:flex h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Disparar fluxo manualmente"
            disabled={!conversationData?.conversation}
          >
            <Workflow className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" size="icon" onClick={() => setScheduleOpen(true)}
            className="hidden sm:flex h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Agendar reunião"
          >
            <CalendarPlus className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" size="icon" onClick={toggleSearch}
            className={`hidden sm:flex h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted ${searchOpen ? 'bg-muted text-foreground' : ''}`}
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggleInspector} className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted" aria-label={showInspector ? "Fechar painel" : "Abrir painel"}>
            {showInspector ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
          </Button>
          <ChatHeaderMenu contactId={contactId} onToggleInspector={onToggleInspector} showInspector={showInspector} onStartSelection={() => setSelectedMessageIds(new Set(["__selection_mode_active__"]))} />
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input ref={searchInputRef} placeholder="Buscar na conversa..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 text-sm bg-background border-border" />
          {searchResults.length > 0 && <span className="text-xs text-muted-foreground whitespace-nowrap">{currentSearchIndex + 1}/{searchResults.length}</span>}
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={searchResults.length === 0} onClick={() => setCurrentSearchIndex(i => (i - 1 + searchResults.length) % searchResults.length)}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={searchResults.length === 0} onClick={() => setCurrentSearchIndex(i => (i + 1) % searchResults.length)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={toggleSearch}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Message selection bar */}
      {selectionMode && (
        <MessageSelectionBar
          count={actualSelectedCount}
          onCopy={handleCopyMessages}
          onDelete={handleDeleteMessages}
          onForward={handleForwardMessages}
          onCancel={() => setSelectedMessageIds(new Set())}
          isDeleting={deleteMessagesMutation.isPending}
        />
      )}

      {/* Active call banner */}
      {activeCall && (
        <ActiveCallBanner callId={activeCall.id} status={activeCall.status} callType={activeCall.call_type} callReason={activeCall.call_reason} createdAt={activeCall.created_at} contactId={contactId!} />
      )}

      {/* Meta Window Bar */}
      {metaWindow.isMetaInstance && !metaWindow.isLoading && (
        <MetaWindowBar
          remainingMs={metaWindow.remainingMs}
          windowType={metaWindow.windowType}
          isFromCampaign={metaWindow.isFromCampaign}
        />
      )}

      {/* Instagram DM Window Bar */}
      {isInstagramChannel && (
        <IgWindowBar
          expiresAt={igDmWindowExpiresAt}
          humanAgentMode={igHumanAgentMode}
          onToggleHumanAgent={setIgHumanAgentMode}
        />
      )}

      {/* Storage limit warning */}
      {storageAtLimit && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20">
          <Ban className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">Limite de armazenamento atingido — envio de mídias desativado</span>
        </div>
      )}

      {/* Blocked contact warning */}
      {contact?.is_blocked && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20">
          <Ban className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">Contato bloqueado - envio de mensagens desativado</span>
        </div>
      )}

      {/* Scheduled messages banner */}
      {pendingScheduledCount > 0 && (
        <button
          type="button"
          onClick={() => setScheduledListOpen(true)}
          className="flex items-center gap-2 px-4 py-1.5 bg-accent/10 border-b border-accent/20 text-xs text-accent-foreground hover:bg-accent/15 transition-colors text-left"
        >
          <Clock className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="text-foreground">
            <strong>{pendingScheduledCount}</strong>{" "}
            {pendingScheduledCount === 1 ? "mensagem agendada" : "mensagens agendadas"}
          </span>
          <span className="ml-auto text-muted-foreground hover:text-foreground">
            Gerenciar →
          </span>
        </button>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-2 sm:p-4 min-h-0">
        <div className="min-h-full">
          {messagesLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                  <Skeleton className={`h-16 ${i % 2 === 0 ? "w-40 sm:w-48" : "w-44 sm:w-56"} rounded-lg bg-muted`} />
                </div>
              ))}
            </div>
          ) : conversationData?.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <p className="text-sm">Nenhuma mensagem nos últimos 3 dias</p>
              <p className="text-xs mt-1">Comece uma conversa!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversationData?.messages.map((msg, idx) => {
                const isHighlighted = searchResults.includes(idx) && searchResults[currentSearchIndex] === idx;
                
                // Date separator logic
                let showDateSeparator = false;
                let dateLabel = "";
                const msgDate = new Date(msg.timestamp);
                const msgDay = msgDate.toDateString();
                
                if (idx === 0) {
                  showDateSeparator = true;
                } else {
                  const prevMsg = conversationData.messages[idx - 1];
                  const prevDay = new Date(prevMsg.timestamp).toDateString();
                  showDateSeparator = msgDay !== prevDay;
                }
                
                if (showDateSeparator) {
                  if (isToday(msgDate)) {
                    dateLabel = "Hoje";
                  } else if (isYesterday(msgDate)) {
                    dateLabel = "Ontem";
                  } else if (differenceInCalendarDays(new Date(), msgDate) <= 7) {
                    dateLabel = format(msgDate, "EEEE", { locale: ptBR });
                    dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
                  } else {
                    dateLabel = format(msgDate, "dd/MM/yy");
                  }
                }

                return (
                  <div key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex items-center gap-3 my-3 px-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs font-medium text-muted-foreground bg-background px-2 py-0.5 rounded-md shadow-sm border border-border">
                          {dateLabel}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    <div id={`msg-${idx}`} className={isHighlighted ? "ring-2 ring-primary rounded-lg" : ""}>
                      <MessageBubble
                        message={msg}
                        contactName={contact?.name || undefined}
                        selectionMode={selectionMode}
                        isSelected={selectedMessageIds.has(msg.id)}
                        onToggleSelect={() => toggleMessageSelect(msg.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Attached file preview */}
      {attachedFile && (
        <div className="px-3 pt-2 flex items-center gap-2 bg-background border-t border-border">
          <div
            className={`flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm text-foreground flex-1 min-w-0 transition-opacity ${
              sendMessageMutation.isPending ? "opacity-60" : ""
            }`}
          >
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate flex-1 min-w-0">{attachedFile.name}</span>
            {sendMessageMutation.isPending && (
              <span className="flex items-center gap-1.5 shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                <Loader2 className="h-3 w-3 animate-spin" />
                Enviando
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setAttachedFile(null)}
            disabled={sendMessageMutation.isPending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* AI Suggestions */}
      {aiSuggestEnabled && (
        <TextSuggestionBar suggestions={suggestions} isLoading={suggestLoading} onSelect={handleSuggestionSelect} />
      )}

      {/* Meta Template Selector when window expired */}
      {isMetaWindowExpired && (
        <MetaTemplateSelector
          instanceId={contact?.instance?.id || null}
          conversationId={resolvedConvId || ""}
          onSent={() => {
            queryClient.invalidateQueries({ queryKey: ["crm-messages", contactId], exact: false });
            queryClient.invalidateQueries({ queryKey: ["meta-window", resolvedConvId] });
          }}
        />
      )}

      {/* Message Input - hidden when Meta window expired */}
      {!isMetaWindowExpired && (
      <div className="relative p-2 sm:p-3 border-t border-border bg-background pb-safe">
        {/* Quick Reply Popover */}
        <QuickReplyPopover
          open={quickReplyOpen}
          onClose={() => { setQuickReplyOpen(false); setQuickReplyFilter(""); }}
          onSelect={handleQuickReplySelect}
          filter={quickReplyFilter}
          instanceId={contact?.instance?.id || null}
        />

        {isRecording ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={cancelRecording} className="h-10 w-10 text-destructive hover:bg-destructive/10 shrink-0">
              <X className="h-5 w-5" />
            </Button>
            <div className="flex-1 flex items-center gap-3 bg-muted rounded-lg px-4 py-2">
              <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-foreground">{formatDuration(recordingDuration)}</span>
              <span className="text-xs text-muted-foreground">Gravando...</span>
            </div>
            <Button variant="ghost" size="icon" onClick={sendRecording} className="h-10 w-10 text-accent hover:bg-accent/10 shrink-0">
              <Send className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Emoji picker */}
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0">
                  <Smile className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-80 p-2">
                <EmojiPicker onSelect={handleEmojiClick} />
              </PopoverContent>
            </Popover>

            {/* Quick Replies button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setQuickReplyOpen(prev => !prev); setQuickReplyFilter(""); }}
              className={`h-10 w-10 sm:h-9 sm:w-9 shrink-0 ${quickReplyOpen ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              title="Respostas rápidas (/)"
            >
              <Zap className="h-4 w-4" />
            </Button>

            {/* File attachment */}
            <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0" onClick={() => fileInputRef.current?.click()} disabled={sendMessageMutation.isPending}>
              <Paperclip className="h-5 w-5" />
            </Button>
            <input ref={fileInputRef} type="file" accept={isInstagramChannel ? "image/*,audio/*,video/*" : "image/*,audio/*,video/*,.pdf,.docx,.xlsx,.pptx,.txt"} className="hidden" onChange={handleFileSelect} />

            {/* AI Suggest toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setAiSuggestEnabled(prev => !prev); setSuggestions([]); }}
              className={`h-10 w-10 sm:h-9 sm:w-9 shrink-0 ${aiSuggestEnabled ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              title={aiSuggestEnabled ? "Desativar sugestões IA" : "Ativar sugestões IA"}
            >
              <Wand2 className="h-4 w-4" />
            </Button>
            
            <textarea
              ref={textareaRef}
              placeholder={contact?.is_blocked ? "Contato bloqueado" : "Digite uma mensagem"}
              value={message}
              data-guide="send-message"
              onChange={e => {
                const val = e.target.value;
                setMessage(val);

                // Quick reply detection: starts with / and no spaces yet
                if (val.startsWith("/") && !val.includes(" ")) {
                  setQuickReplyOpen(true);
                  setQuickReplyFilter(val.slice(1));
                } else if (quickReplyOpen && !val.startsWith("/")) {
                  setQuickReplyOpen(false);
                  setQuickReplyFilter("");
                } else if (val.startsWith("/")) {
                  setQuickReplyFilter(val.slice(1).split(" ")[0]);
                }

                // Auto-resize
                const el = e.target;
                el.style.height = "40px";
                const newHeight = Math.min(el.scrollHeight, 120);
                el.style.height = newHeight + "px";
                el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
              }}
              className="flex-1 min-h-[40px] max-h-[120px] py-2.5 px-3 text-base sm:text-sm bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary resize-none overflow-hidden"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              disabled={contact?.is_blocked || sendMessageMutation.isPending}
              rows={1}
            />
            
            {message.trim() || attachedFile ? (
              <Button variant="ghost" size="icon" onClick={handleSendMessage} disabled={contact?.is_blocked || sendMessageMutation.isPending} className="h-10 w-10 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0">
                {sendMessageMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={startRecording} disabled={contact?.is_blocked} className="h-10 w-10 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0">
                <Mic className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}

        {/* Quick Reply Shortcuts (pills below input) */}
        {!isRecording && (
          <QuickReplyShortcuts
            onSelect={handleQuickReplySelect}
            disabled={contact?.is_blocked || sendMessageMutation.isPending}
            instanceId={contact?.instance?.id || null}
          />
        )}
      </div>



      )}

      {/* Forward dialog */}
      {contactId && (
        <ForwardMessageDialog
          open={forwardOpen}
          onOpenChange={(open) => {
            setForwardOpen(open);
            if (!open) setSelectedMessageIds(new Set());
          }}
          messages={
            conversationData?.messages
              .filter(m => selectedMessageIds.has(m.id))
              .map(m => ({ content: m.content, content_type: m.content_type, media_url: m.media_url })) || []
          }
          sourceContactId={contactId}
        />
      )}

      {/* Schedule event dialog */}
      <ScheduleEventDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        contactName={displayName}
        conversationId={conversationData?.conversation?.id}
      />

      {/* Reminder dialog */}
      <ReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        contactId={contactId}
        conversationId={conversationData?.conversation?.id || null}
        contactName={displayName}
      />

      {/* Trigger flow dialog */}
      <TriggerFlowDialog
        open={triggerFlowOpen}
        onOpenChange={setTriggerFlowOpen}
        conversationId={conversationData?.conversation?.id || null}
        contactName={displayName}
      />

      {/* Quick replies manager dialog */}
      <Dialog open={quickReplyManagerOpen} onOpenChange={setQuickReplyManagerOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              Respostas Rápidas
            </DialogTitle>
          </DialogHeader>
          <QuickReplyManager />
        </DialogContent>
      </Dialog>

      {/* Schedule message dialog */}
      {resolvedConvId && contactId && userOrg?.id && (
        <ScheduleMessageDialog
          open={scheduleMessageOpen}
          onOpenChange={setScheduleMessageOpen}
          conversationId={resolvedConvId}
          contactId={contactId}
          organizationId={userOrg.id}
          instanceId={contact?.instance?.id || null}
        />
      )}

      {/* Scheduled messages list dialog */}
      {resolvedConvId && contactId && userOrg?.id && (
        <ScheduledMessagesList
          open={scheduledListOpen}
          onOpenChange={setScheduledListOpen}
          conversationId={resolvedConvId}
          contactId={contactId}
          organizationId={userOrg.id}
          instanceId={contact?.instance?.id || null}
        />
      )}
    </div>
  );
}
