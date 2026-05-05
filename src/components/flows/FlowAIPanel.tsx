import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  Replace,
  Merge,
  Bot,
  User,
  Lightbulb,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  importFlowSteps,
  type FlowExportData,
} from "./FlowImportExport";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  flow?: FlowExportData | null;
  applied?: boolean;
}

interface FlowAIPanelProps {
  open: boolean;
  onClose: () => void;
  flowId: string;
  onFlowApplied: () => void;
}

const SUGGESTIONS = [
  { label: "Atendimento com menu", prompt: "Crie um fluxo de atendimento com menu de opções: Suporte, Vendas e Financeiro. Cada opção deve direcionar para uma resposta diferente." },
  { label: "Qualificação de leads", prompt: "Crie um fluxo de qualificação de leads que coleta nome, email, telefone e interesse do contato, e classifica como lead quente ou frio." },
  { label: "Pesquisa de satisfação", prompt: "Crie um fluxo de pesquisa de satisfação NPS que pergunta a nota de 0 a 10, e com base na resposta agradece ou pede mais feedback." },
  { label: "Agendamento", prompt: "Crie um fluxo de agendamento que coleta o nome, a data e horário preferido do contato para agendar uma reunião." },
];

export function FlowAIPanel({ open, onClose, flowId, onFlowApplied }: FlowAIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada. Faça login novamente.");
        setLoading(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-flow-builder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || "Erro ao consultar IA";
        toast.error(errMsg);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `❌ ${errMsg}` },
        ]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      const assistantMsg: Message = {
        role: "assistant",
        content: data.text || "Fluxo gerado com sucesso!",
        flow: data.flow || null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      console.error("AI Flow Builder error:", e);
      toast.error("Erro de conexão com o assistente");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Erro de conexão. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFlow = async (
    flow: FlowExportData,
    mode: "replace" | "merge",
    msgIndex: number
  ) => {
    try {
      const success = await importFlowSteps(flowId, flow, mode);
      if (success) {
        toast.success(
          mode === "replace"
            ? "Fluxo aplicado no canvas!"
            : "Fluxo mesclado ao canvas!"
        );
        setMessages((prev) =>
          prev.map((m, i) => (i === msgIndex ? { ...m, applied: true } : m))
        );
        onFlowApplied();
      } else {
        toast.error("Erro ao aplicar fluxo");
      }
    } catch {
      toast.error("Erro ao aplicar fluxo");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!open) return null;

  return (
    <div className="w-[380px] h-full border-l border-border/50 bg-background/95 backdrop-blur-md flex flex-col z-20">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Assistente de Fluxos</h3>
            <p className="text-xs text-muted-foreground">
              Descreva o fluxo que precisa
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="text-center py-4">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Descreva o fluxo que deseja e eu construo para você!
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" /> Sugestões rápidas
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => sendMessage(s.prompt)}
                    className="w-full text-left text-xs p-2.5 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <span className="font-medium">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-3 w-3 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg p-2.5 text-xs ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 border border-border/30"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none text-xs [&_p]:mb-1 [&_li]:mb-0.5 [&_ul]:mb-1 [&_ol]:mb-1 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}

                {/* Flow action buttons */}
                {msg.flow && !msg.applied && (
                  <div className="mt-2 pt-2 border-t border-border/30 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        {msg.flow.steps.length} etapas
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                        {msg.flow.connections.length} conexões
                      </Badge>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1 gradient-primary"
                        onClick={() => handleApplyFlow(msg.flow!, "replace", i)}
                      >
                        <Replace className="h-3 w-3 mr-1" />
                        Substituir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1"
                        onClick={() => handleApplyFlow(msg.flow!, "merge", i)}
                      >
                        <Merge className="h-3 w-3 mr-1" />
                        Mesclar
                      </Button>
                    </div>
                  </div>
                )}

                {msg.applied && (
                  <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Aplicado ao canvas</span>
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-3 w-3 text-primary" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 items-start">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                <Bot className="h-3 w-3 text-white" />
              </div>
              <div className="bg-muted/50 rounded-lg p-3 border border-border/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Construindo seu fluxo...
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border/50">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreva o fluxo que precisa..."
            className="min-h-[40px] max-h-[100px] text-xs resize-none"
            rows={1}
          />
          <Button
            size="icon"
            className="h-10 w-10 flex-shrink-0 gradient-primary"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
