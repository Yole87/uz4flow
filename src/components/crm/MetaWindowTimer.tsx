import { useState, useEffect, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Timer } from "lucide-react";

interface MetaWindowTimerProps {
  conversationId: string;
}

function formatTimer(ms: number): string {
  if (ms <= 0) return "";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const MetaWindowTimer = memo(function MetaWindowTimer({ conversationId }: MetaWindowTimerProps) {
  const [remainingMs, setRemainingMs] = useState(0);

  const { data: windowData } = useQuery({
    queryKey: ["meta-window", conversationId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meta_conversation_windows")
        .select("window_expires_at")
        .eq("conversation_id", conversationId)
        .maybeSingle();
      if (error) throw error;
      return data as { window_expires_at: string } | null;
    },
    enabled: !!conversationId,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const expiresAt = windowData?.window_expires_at
    ? new Date(windowData.window_expires_at).getTime()
    : null;

  useEffect(() => {
    if (!expiresAt) {
      setRemainingMs(0);
      return;
    }
    const calc = () => setRemainingMs(Math.max(0, expiresAt - Date.now()));
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remainingMs <= 0) return null;

  const formatted = formatTimer(remainingMs);
  const isUrgent = remainingMs < 3600000; // < 1h

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-mono leading-none ${
      isUrgent ? "text-destructive" : "text-emerald-400"
    }`}>
      <Timer className="h-2.5 w-2.5" />
      {formatted}
    </span>
  );
});
