import { useState, useRef, useEffect } from "react";
import { X, Send, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiaAvatar } from "./LiaAvatar";
import { useLia } from "./LiaProvider";
import { useLiaChat } from "@/hooks/useLiaChat";
import ReactMarkdown from "react-markdown";

const WELCOME_MESSAGE = "Olá! 👋 Eu sou a **LIA**, sua assistente virtual do OpenFlow!\n\nEstou aqui para te ajudar com qualquer dúvida sobre a plataforma. Pode me perguntar sobre:\n\n- Como usar o **CRM** e enviar mensagens\n- Configurar o **Funil Kanban** de vendas\n- Criar **campanhas de Follow-up**\n- **Prospectar** novos clientes\n- E muito mais!\n\nComo posso te ajudar? 😊";

export function LiaChatPanel() {
  const { isOpen, setIsOpen, messages, setMessages } = useLia();
  const { sendMessage, clearChat, isStreaming } = useLiaChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasGreeted = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0 && !hasGreeted.current) {
      hasGreeted.current = true;
      setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
    }
  }, [isOpen, messages.length, setMessages]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 sm:right-6 z-[9998] w-[calc(100vw-2rem)] sm:w-[400px] max-h-[70vh] sm:max-h-[600px] flex flex-col rounded-2xl border border-border/50 quantum-glass-strong shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-primary/10 to-secondary/10">
        <LiaAvatar size={36} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">LIA</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-terminal">
            Assistente OpenFlow
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={clearChat} title="Limpar conversa">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" style={{ maxHeight: "calc(70vh - 130px)" }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="shrink-0 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <LiaAvatar size={24} />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted/60 text-foreground rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&_li]:mb-0.5 [&_strong]:text-primary-foreground [&_a]:text-accent [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded">
                  <ReactMarkdown>{msg.content.replace(/```guided_steps[\s\S]*?```/g, "✅ Suporte Assistido ativado! Siga os passos na tela.")}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2.5 justify-start">
             <div className="shrink-0 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <LiaAvatar size={24} />
            </div>
            <div className="bg-muted/60 rounded-2xl rounded-bl-md px-3.5 py-2.5">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Digitando...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/30 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo à LIA..."
            className="flex-1 resize-none bg-muted/30 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors min-h-[40px] max-h-[100px]"
            rows={1}
            disabled={isStreaming}
            style={{ height: "40px" }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = "40px";
              el.style.height = Math.min(el.scrollHeight, 100) + "px";
            }}
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl gradient-primary border-0 neon-glow-pink flex-shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
