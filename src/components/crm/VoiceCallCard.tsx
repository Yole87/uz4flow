import { useState } from "react";
import { Phone, Clock, ChevronDown, ChevronUp, CheckCircle, XCircle, PhoneOff, Play, User, Bot, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TranscriptEntry {
  role: "customer" | "ai";
  content: string;
  time?: number;
}

interface VoiceCallData {
  type: string;
  voice_call_id: string;
  duration_seconds: number;
  summary: string;
  ended_reason: string;
  customer_action: string | null;
  call_reason?: string | null;
  transcript?: TranscriptEntry[] | null;
  recording_url?: string | null;
}

interface VoiceCallCardProps {
  content: string;
  isOutbound: boolean;
  contactName?: string;
  timestamp?: string;
}

export function VoiceCallCard({ content, isOutbound, contactName, timestamp }: VoiceCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  let callData: VoiceCallData | null = null;
  try {
    callData = JSON.parse(content);
  } catch {
    return <p className="text-sm text-muted-foreground">📞 Ligação IA</p>;
  }

  if (!callData) return null;

  const duration = callData.duration_seconds || 0;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;
  const durationStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isSuccess = callData.ended_reason !== "error" && callData.ended_reason !== "failed";
  const displayName = contactName || "Cliente";

  const formattedDate = timestamp
    ? format(new Date(timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  return (
    <div className="rounded-lg border border-border/50 bg-card/30 p-3 min-w-[220px] max-w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          "p-1.5 rounded-full",
          isSuccess ? "bg-accent/20" : "bg-destructive/20"
        )}>
          {isSuccess ? (
            <Phone className="h-3.5 w-3.5 text-accent" />
          ) : (
            <PhoneOff className="h-3.5 w-3.5 text-destructive" />
          )}
        </div>
        <span className="text-xs font-medium text-foreground">Ligação IA</span>
        <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{durationStr}</span>
        </div>
      </div>

      {/* Date */}
      {formattedDate && (
        <p className="text-xs text-muted-foreground mb-1">{formattedDate}</p>
      )}

      {/* Call Reason */}
      {callData.call_reason && (
        <div className="flex items-center gap-1.5 mb-2 text-xs">
          <FileText className="h-3 w-3 text-accent" />
          <span className="text-muted-foreground">Motivo: <span className="text-foreground">{callData.call_reason}</span></span>
        </div>
      )}

      {/* Summary */}
      <p className="text-xs text-muted-foreground line-clamp-2">{callData.summary}</p>

      {/* Customer Action */}
      {callData.customer_action && (
        <div className="flex items-center gap-1.5 mt-2 text-xs">
          <CheckCircle className="h-3 w-3 text-accent" />
          <span className="text-accent font-medium">
            Ação: {callData.customer_action}
          </span>
        </div>
      )}

      {/* Error */}
      {!isSuccess && (
        <div className="flex items-center gap-1.5 mt-2 text-xs">
          <XCircle className="h-3 w-3 text-destructive" />
          <span className="text-destructive">{callData.ended_reason}</span>
        </div>
      )}

      {/* Expand/Collapse */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="w-full mt-2 h-6 text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3 w-3 mr-1" />
            Ocultar detalhes
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3 mr-1" />
            Ver transcrição
          </>
        )}
      </Button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
          {/* Recording */}
          {callData.recording_url && (
            <div className="flex items-center gap-2">
              <Play className="h-3 w-3 text-accent" />
              <a
                href={callData.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent underline hover:text-accent/80"
              >
                Ouvir gravação
              </a>
            </div>
          )}

          {/* Transcript */}
          {callData.transcript && callData.transcript.length > 0 ? (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Transcrição</p>
              {callData.transcript.map((entry, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <div className={cn(
                    "shrink-0 mt-0.5 p-0.5 rounded-full",
                    entry.role === "customer" ? "bg-primary/20" : "bg-secondary/20"
                  )}>
                    {entry.role === "customer" ? (
                      <User className="h-2.5 w-2.5 text-primary" />
                    ) : (
                      <Bot className="h-2.5 w-2.5 text-secondary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className={cn(
                      "font-medium text-xs",
                      entry.role === "customer" ? "text-primary" : "text-secondary"
                    )}>
                      {entry.role === "customer" ? displayName : "IA"}
                      {entry.time != null && (
                        <span className="text-muted-foreground ml-1">
                          {Math.floor(entry.time / 60)}:{String(Math.floor(entry.time % 60)).padStart(2, "0")}
                        </span>
                      )}
                    </span>
                    <p className="text-muted-foreground">{entry.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Transcrição não disponível</p>
          )}

          <div className="text-xs text-muted-foreground pt-1 border-t border-border/30">
            <p>ID: {callData.voice_call_id?.slice(0, 8)}...</p>
          </div>
        </div>
      )}
    </div>
  );
}
