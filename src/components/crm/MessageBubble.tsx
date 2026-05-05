import { useState } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Clock, AlertCircle, Image, FileText, Video, Bot, User, Download, ImageOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceCallCard } from "./VoiceCallCard";
import { WhatsAppAudioPlayer } from "./WhatsAppAudioPlayer";
import { downloadMediaFile, openMediaFile } from "@/lib/downloadMedia";
import { useMediaBlob } from "@/hooks/useMediaBlob";

interface Message {
  id: string;
  direction: string;
  content_type: string;
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  status: string;
  timestamp: string;
  sender_type?: "customer" | "ia" | "attendant" | null;
  sender_name?: string | null;
  metadata?: unknown;
}

interface MessageBubbleProps {
  message: Message;
  contactName?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

/** Extract filename from content like "[arquivo: report.pdf]" */
function extractFileName(content: string | null): string | null {
  if (!content) return null;
  const match = content.match(/^\[arquivo:\s*(.+)\]$/i);
  return match ? match[1] : null;
}

const URL_REGEX = /(https?:\/\/[^\s<]+)/gi;
// Tokens de formatação inline estilo WhatsApp/Instagram: *bold*, _italic_, ~strike~, `code`
const FORMAT_REGEX = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;

/** Aplica formatação inline (negrito/itálico/etc) sobre um trecho de texto puro. */
function renderInlineFormat(text: string, keyPrefix: string): React.ReactNode {
  const parts = text.split(FORMAT_REGEX);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*[^*\n]+\*$/.test(part)) {
      return <strong key={key} className="font-semibold">{part.slice(1, -1)}</strong>;
    }
    if (/^_[^_\n]+_$/.test(part)) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (/^~[^~\n]+~$/.test(part)) {
      return <span key={key} className="line-through opacity-80">{part.slice(1, -1)}</span>;
    }
    if (/^`[^`\n]+`$/.test(part)) {
      return <code key={key} className="px-1 py-0.5 rounded bg-black/20 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    }
    return <span key={key}>{part}</span>;
  });
}

/** Render text with clickable URLs e formatação inline (estilo WhatsApp/IG). */
function renderTextWithLinks(text: string | null): React.ReactNode {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    URL_REGEX.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all hover:opacity-80">
        {part}
      </a>
    ) : (
      <span key={i}>{renderInlineFormat(part, `t${i}`)}</span>
    )
  );
}

export function MessageBubble({ message, contactName, selectionMode, isSelected, onToggleSelect }: MessageBubbleProps) {
  const [mediaError, setMediaError] = useState(false);
  
  // Load media via authenticated SDK (bucket is private)
  const needsBlob = message.media_url && ["image", "video", "audio"].includes(message.content_type);
  const { blobUrl, loading: mediaLoading, error: blobError } = useMediaBlob(needsBlob ? message.media_url : null);
  
  const senderType = message.sender_type || (message.direction === "inbound" ? "customer" : "attendant");
  const isCustomer = senderType === "customer";
  const isIA = senderType === "ia";
  const isAttendant = senderType === "attendant";
  const isOutbound = !isCustomer;
  
  const time = format(new Date(message.timestamp), "HH:mm");

  const StatusIcon = () => {
    switch (message.status) {
      case "pending":
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-accent" />;
      case "failed":
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      default:
        return null;
    }
  };

  const renderContent = () => {
    const mediaUrl = message.media_url;
    const mime = message.media_mime_type || "";
    const fileName = extractFileName(message.content);
    const meta = (message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata))
      ? message.metadata as Record<string, unknown>
      : null;
    const transcript = meta?.transcript ? String(meta.transcript) : null;

    switch (message.content_type) {
      case "image":
        if (mediaError || blobError) {
          return (
            <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted/30 rounded-lg">
              <ImageOff className="h-5 w-5 shrink-0" />
              <span className="text-sm">Imagem (link expirado)</span>
            </div>
          );
        }
        if (!mediaUrl) {
          return (
            <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted/30 rounded-lg">
              <Trash2 className="h-5 w-5 shrink-0" />
              <span className="text-sm">Mídia removida pela limpeza</span>
            </div>
          );
        }
        if (mediaLoading) {
          return (
            <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted/30 rounded-lg animate-pulse">
              <Image className="h-5 w-5 shrink-0" />
              <span className="text-sm">Carregando...</span>
            </div>
          );
        }
        return (
          <div className="mb-1">
            <img 
              src={blobUrl || ""} 
              alt="Image" 
              className="max-w-full rounded-lg max-h-64 object-cover cursor-pointer"
              onClick={() => openMediaFile(mediaUrl)}
              onError={() => setMediaError(true)}
            />
            {message.content && message.content !== "[Imagem]" && !fileName && (
              <p className="mt-2 text-sm">{message.content}</p>
            )}
          </div>
        );
      
      case "audio":
        if (!mediaUrl) {
          return (
            <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted/30 rounded-lg min-w-[160px]">
              <Trash2 className="h-4 w-4 shrink-0" />
              <span className="text-sm">Áudio removido pela limpeza</span>
            </div>
          );
        }
        return (
          <WhatsAppAudioPlayer src={blobUrl || mediaUrl} mime={mime} isOutbound={isOutbound} transcript={transcript} loading={mediaLoading} />
        );

      case "video":
        if (mediaError || blobError) {
          return (
            <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted/30 rounded-lg">
              <Video className="h-5 w-5 shrink-0" />
              <span className="text-sm">Vídeo (link expirado)</span>
            </div>
          );
        }
        if (!mediaUrl) {
          return (
            <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted/30 rounded-lg">
              <Trash2 className="h-4 w-4 shrink-0" />
              <span className="text-sm">Vídeo removido pela limpeza</span>
            </div>
          );
        }
        if (mediaLoading) {
          return (
            <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted/30 rounded-lg animate-pulse">
              <Video className="h-5 w-5 shrink-0" />
              <span className="text-sm">Carregando...</span>
            </div>
          );
        }
        return (
          <video 
            src={blobUrl || ""} 
            controls 
            preload="none"
            className="max-w-full rounded-lg max-h-64"
            onError={() => setMediaError(true)}
          />
        );

      case "document": {
        const displayName = fileName || message.content || "Documento";
        if (!mediaUrl) {
          return (
            <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
              <div className="p-2 bg-muted rounded shrink-0">
                <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium truncate text-muted-foreground">
                  Arquivo removido pela limpeza
                </p>
              </div>
            </div>
          );
        }
        return (
          <div 
            onClick={() => downloadMediaFile(mediaUrl, displayName)}
            className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <div className="p-2 bg-muted rounded shrink-0">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground">{mime || "Documento"}</p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        );
      }

      case "voice_call":
        return <VoiceCallCard content={message.content || "{}"} isOutbound={isOutbound} timestamp={message.timestamp} contactName={contactName} />;

      default:
        return <p className="text-sm whitespace-pre-wrap break-words">{renderTextWithLinks(message.content)}</p>;
    }
  };

  const handleClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect();
    }
  };

  return (
    <div 
      className={cn(
        "flex",
        isCustomer ? "justify-start" : "justify-end",
        selectionMode && "cursor-pointer",
        isSelected && "bg-accent/5 rounded-lg"
      )}
      data-testid="message-bubble"
      onClick={handleClick}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <div className="flex items-center px-1 shrink-0">
          <div className={cn(
            "h-4 w-4 rounded-full border-2 transition-colors",
            isSelected ? "bg-accent border-accent" : "border-muted-foreground"
          )} />
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%] md:max-w-[65%]",
          "rounded-lg px-3 py-2 shadow-sm",
          isCustomer && "bg-card text-card-foreground rounded-bl-sm",
          isIA && "bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground rounded-br-sm shadow-lg neon-glow-purple border border-secondary/30",
          isAttendant && "bg-gradient-to-r from-primary/80 to-secondary/60 text-primary-foreground rounded-br-sm"
        )}
      >
        {isIA && (
          <div className="flex items-center gap-1 mb-1.5 text-xs text-secondary-foreground/70">
            <Bot className="h-3 w-3" />
            <span className="font-medium">IA</span>
          </div>
        )}

        {isAttendant && (
          <div className="flex items-center gap-1 mb-1.5 text-xs text-primary-foreground/70">
            <User className="h-3 w-3" />
            <span className="font-medium">{message.sender_name || "Atendente"}</span>
          </div>
        )}

        {renderContent()}
        
        <div className={cn(
          "flex items-center justify-end gap-1 mt-1",
          isCustomer ? "text-muted-foreground" : "text-white/70"
        )}>
          <span className="text-xs sm:text-xs">{time}</span>
          {isOutbound && <StatusIcon />}
        </div>
      </div>
    </div>
  );
}
