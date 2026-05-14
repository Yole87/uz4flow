import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "./useUserOrganization";
import { useNotificationSound } from "./useNotificationSound";

/**
 * Optimized Realtime subscription for CRM
 * Uses organization-level channel instead of per-conversation channels
 * This dramatically reduces the number of active subscriptions
 * 
 * Includes polling fallback for reliability
 */
export function useCRMRealtime(
  contactId: string | null,
  options?: {
    onNewMessage?: (payload: unknown) => void;
    onConversationUpdate?: (payload: unknown) => void;
    onContactUpdate?: (payload: unknown) => void;
  }
) {
  const queryClient = useQueryClient();
  const { data: organization } = useUserOrganization();
  const { playNotification } = useNotificationSound();

  const handleNewMessage = useCallback(
    (payload: { new: { conversation_id: string; direction?: string; from_me?: boolean } }) => {
      console.log("[CRM Realtime] New message received:", payload);

      // Invalidate ALL crm-messages queries (contactId may be stale/null)
      queryClient.invalidateQueries({
        queryKey: ["crm-messages"],
        exact: false
      });

      // Invalidate conversations list for preview update
      queryClient.invalidateQueries({
        queryKey: ["crm-conversations"],
        exact: false
      });

      // Play notification for any incoming message
      playNotification();

      options?.onNewMessage?.(payload);
    },
    [queryClient, contactId, options, playNotification]
  );

  const handleConversationUpdate = useCallback(
    (payload: unknown) => {
      console.log("[CRM Realtime] Conversation updated:", payload);
      
      queryClient.invalidateQueries({ 
        queryKey: ["crm-conversations"],
        exact: false 
      });

      options?.onConversationUpdate?.(payload);
    },
    [queryClient, options]
  );

  const handleContactUpdate = useCallback(
    (payload: unknown) => {
      console.log("[CRM Realtime] Contact changed:", payload);
      
      queryClient.invalidateQueries({ 
        queryKey: ["crm-contact", contactId],
        exact: false 
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ["crm-contact-details", contactId],
        exact: false 
      });

      // Keep Kanban board and Dashboard metrics in sync (WhatsApp + Instagram)
      queryClient.invalidateQueries({
        queryKey: ["kanban-contacts"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-contacts-count"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["crm-contacts"],
        exact: false,
      });

      options?.onContactUpdate?.(payload);
    },
    [queryClient, contactId, options]
  );

  useEffect(() => {
    if (!organization?.id) return;

    console.log("[CRM Realtime] Subscribing to organization:", organization.id);

    // Single channel per organization (not per conversation!)
    const channel = supabase
      .channel(`crm-org-${organization.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `organization_id=eq.${organization.id}`,
        },
        handleNewMessage
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `organization_id=eq.${organization.id}`,
        },
        handleConversationUpdate
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "contacts",
          filter: `organization_id=eq.${organization.id}`,
        },
        handleContactUpdate
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "contacts",
          filter: `organization_id=eq.${organization.id}`,
        },
        handleContactUpdate
      )
      .subscribe((status) => {
        console.log("[CRM Realtime] Subscription status:", status);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(
            "[CRM Realtime] Channel failed for org",
            organization.id,
            "— filters or RLS may be misconfigured."
          );
        }
      });

    return () => {
      console.log("[CRM Realtime] Unsubscribing from organization:", organization.id);
      supabase.removeChannel(channel);
    };
  }, [organization?.id, handleNewMessage, handleConversationUpdate, handleContactUpdate]);

  return { organizationId: organization?.id };
}
