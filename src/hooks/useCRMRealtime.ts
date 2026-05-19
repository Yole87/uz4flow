import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "./useUserOrganization";
import { useNotificationSound } from "./useNotificationSound";

/**
 * Optimized Realtime subscription for CRM
 * Single org-level channel. MUST only be mounted ONCE per app (in CRMLayout)
 * to avoid duplicate-channel collisions (CHANNEL_ERROR / reconnect loops).
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
    (payload: { new: { conversation_id?: string; direction?: string; from_me?: boolean } }) => {
      queryClient.invalidateQueries({ queryKey: ["crm-messages"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"], exact: false });

      const msg = payload?.new ?? ({} as any);
      const isInbound = msg.direction === "inbound" || msg.from_me === false;
      if (isInbound) playNotification();

      options?.onNewMessage?.(payload);
    },
    [queryClient, options, playNotification]
  );

  const handleConversationUpdate = useCallback(
    (payload: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"], exact: false });
      options?.onConversationUpdate?.(payload);
    },
    [queryClient, options]
  );

  const handleContactUpdate = useCallback(
    (payload: { new?: any; old?: any }) => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact", contactId], exact: false });
      queryClient.invalidateQueries({ queryKey: ["crm-contact-details", contactId], exact: false });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"], exact: false });

      // Only invalidate Kanban/Dashboard when the pipeline stage actually changed.
      const oldStage = payload?.old?.pipeline_stage_id ?? null;
      const newStage = payload?.new?.pipeline_stage_id ?? null;
      if (oldStage !== newStage) {
        queryClient.invalidateQueries({ queryKey: ["kanban-contacts"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["pipeline-contacts-count"], exact: false });
      }

      options?.onContactUpdate?.(payload);
    },
    [queryClient, contactId, options]
  );

  const handleContactInsert = useCallback(
    (payload: unknown) => {
      // New lead arrived — play notification
      playNotification();
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["kanban-contacts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["pipeline-contacts-count"], exact: false });
      options?.onContactUpdate?.(payload);
    },
    [queryClient, options, playNotification]
  );

  useEffect(() => {
    if (!organization?.id) return;

    // Unique channel name (timestamp suffix) prevents collision if hook
    // accidentally mounts twice during navigation/Strict Mode double-render.
    const channelName = `crm-org-${organization.id}-${Date.now()}`;
    console.log("[CRM Realtime] Subscribing:", channelName);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(channelName)
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
          handleContactInsert
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[CRM Realtime] Channel issue:", status, "— UI continues with polling fallback.");
          }
        });
    } catch (err) {
      // Never let realtime setup break the CRM UI
      console.error("[CRM Realtime] Setup failed:", err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.warn("[CRM Realtime] removeChannel failed:", err);
        }
      }
    };
  }, [organization?.id, handleNewMessage, handleConversationUpdate, handleContactUpdate, handleContactInsert]);

  return { organizationId: organization?.id };
}
