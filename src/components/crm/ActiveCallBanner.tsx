import { useState, useEffect } from "react";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ActiveCallBannerProps {
  callId: string;
  status: string;
  callType: string;
  callReason: string | null;
  createdAt: string;
  contactId: string;
}

export function ActiveCallBanner({ callId, status, callType, callReason, createdAt, contactId }: ActiveCallBannerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const statusLabel = status === "ringing" ? "Chamando..." : status === "in_progress" ? "Em andamento" : "Conectando...";

  const handleEndCall = async () => {
    setEnding(true);
    try {
      await supabase
        .from("voice_calls")
        .update({ status: "completed", ended_reason: "manual_hangup" })
        .eq("id", callId);
      queryClient.invalidateQueries({ queryKey: ["active-voice-call", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-messages"] });
      toast.success("Ligação encerrada");
    } catch {
      toast.error("Erro ao encerrar ligação");
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-accent/10 border-b border-accent/20 animate-in slide-in-from-top duration-300">
      <div className="relative">
        <Phone className="h-4 w-4 text-accent" />
        {status === "ringing" && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent animate-ping" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-accent">{statusLabel}</span>
          <span className="text-xs text-muted-foreground">
            {callType === "script" ? "Script" : "Conversacional"} • {timeStr}
          </span>
        </div>
        {callReason && (
          <p className="text-xs text-muted-foreground truncate">Motivo: {callReason}</p>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleEndCall}
        disabled={ending}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8"
      >
        {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4 sm:mr-1" />}
        <span className="hidden sm:inline">Encerrar</span>
      </Button>
    </div>
  );
}
