import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MetaWindowState {
  isOpen: boolean;
  expiresAt: Date | null;
  windowType: string | null;
  remainingMs: number;
  isFromCampaign: boolean;
  isMetaInstance: boolean;
  isLoading: boolean;
}

export function useMetaWindow(
  conversationId: string | null | undefined,
  instanceProvider?: string | null
): MetaWindowState {
  const [remainingMs, setRemainingMs] = useState(0);

  const isMetaInstance = instanceProvider === "meta_official";

  // Primary: fetch from meta_conversation_windows
  const { data: windowData, isLoading } = useQuery({
    queryKey: ["meta-window", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const { data, error } = await (supabase as any)
        .from("meta_conversation_windows")
        .select("*")
        .eq("conversation_id", conversationId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        conversation_id: string;
        window_type: string;
        window_expires_at: string;
        last_customer_message_at: string;
        is_from_campaign: boolean;
      } | null;
    },
    enabled: !!conversationId && isMetaInstance,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fallback: if no window record, infer from last customer message
  const { data: fallbackData } = useQuery({
    queryKey: ["meta-window-fallback", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const { data, error } = await supabase
        .from("messages")
        .select("timestamp")
        .eq("conversation_id", conversationId)
        .eq("sender_type", "customer")
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId && isMetaInstance && !isLoading && !windowData,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Compute expiresAt: prefer DB record, fallback to last customer msg + 24h
  const expiresAt = windowData?.window_expires_at
    ? new Date(windowData.window_expires_at)
    : (!windowData && fallbackData?.timestamp)
      ? new Date(new Date(fallbackData.timestamp).getTime() + 24 * 60 * 60 * 1000)
      : null;

  useEffect(() => {
    if (!expiresAt) {
      setRemainingMs(0);
      return;
    }

    const calc = () => {
      const diff = expiresAt.getTime() - Date.now();
      setRemainingMs(Math.max(0, diff));
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expiresAt?.getTime()]);

  return {
    isOpen: remainingMs > 0,
    expiresAt,
    windowType: windowData?.window_type || (fallbackData ? "24h" : null),
    remainingMs,
    isFromCampaign: windowData?.is_from_campaign || false,
    isMetaInstance,
    isLoading,
  };
}
