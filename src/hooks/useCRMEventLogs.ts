import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "./useUserOrganization";

export interface CRMWebhookEvent {
  id: string;
  organization_id: string;
  event_type: "inbound" | "outbound";
  status: "success" | "error" | "ignored" | "duplicate" | "pending";
  instance_id?: string;
  phone?: string;
  payload: Record<string, unknown>;
  response?: Record<string, unknown>;
  error_message?: string;
  processing_time_ms?: number;
  created_at: string;
}

export interface EventStats {
  total: number;
  success: number;
  error: number;
  ignored: number;
  duplicate: number;
  lastEventAt: string | null;
}

export function useCRMEventLogs(limit = 50) {
  const queryClient = useQueryClient();
  const { data: organization } = useUserOrganization();
  const organizationId = organization?.id;
  
  const [isPaused, setIsPaused] = useState(false);

  // Fetch events
  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ["crm-webhook-events", organizationId, limit],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("crm_webhook_events")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return (data || []) as CRMWebhookEvent[];
    },
    enabled: !!organizationId,
    staleTime: 15000,
    refetchInterval: isPaused ? false : 30000, // Refetch every 30s if not paused
  });

  // Calculate stats
  const stats: EventStats = {
    total: events?.length || 0,
    success: events?.filter(e => e.status === "success").length || 0,
    error: events?.filter(e => e.status === "error").length || 0,
    ignored: events?.filter(e => e.status === "ignored").length || 0,
    duplicate: events?.filter(e => e.status === "duplicate").length || 0,
    lastEventAt: events?.[0]?.created_at || null,
  };

  // Setup realtime subscription
  useEffect(() => {
    if (!organizationId || isPaused) return;

    const channel = supabase
      .channel(`crm-webhook-events-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "crm_webhook_events",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          console.log("[useCRMEventLogs] New event received:", payload.new);
          
          // Add new event to the top of the list
          queryClient.setQueryData(
            ["crm-webhook-events", organizationId, limit],
            (old: CRMWebhookEvent[] | undefined) => {
              if (!old) return [payload.new as CRMWebhookEvent];
              // Keep only the latest 'limit' events
              return [payload.new as CRMWebhookEvent, ...old].slice(0, limit);
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, isPaused, limit, queryClient]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const clearLogs = useCallback(async () => {
    if (!organizationId) return;
    
    const { error } = await supabase
      .from("crm_webhook_events")
      .delete()
      .eq("organization_id", organizationId);
    
    if (error) throw error;
    
    queryClient.setQueryData(
      ["crm-webhook-events", organizationId, limit],
      []
    );
  }, [organizationId, limit, queryClient]);

  return {
    events: events || [],
    stats,
    isLoading,
    isPaused,
    togglePause,
    refetch,
    clearLogs,
  };
}
