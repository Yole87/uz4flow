import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for "Active Conversations of an organization".
 *
 * Critério canônico (mesmo número exibido em Dashboard e CRM):
 *   - Âncora de tenant: `contacts.organization_id = organizationId`
 *   - `conversations.contact_id IN (contatos da org)` (RLS-friendly, padrão decoupled)
 *   - `conversations.status = 'active'`
 *   - Filtro opcional por `instance_id`
 *   - Ordenação: last_message_at DESC NULLS LAST
 *   - Limite: 1000 (alinhado com mem://constraints/scaling-pagination-limits)
 */

export interface ActiveConversationRow {
  id: string;
  contact_id: string;
  instance_id: string | null;
  channel: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_type: "customer" | "ia" | "attendant" | null;
  unread_count: number;
  status: string;
  dm_window_expires_at: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

interface UseActiveConversationsArgs {
  organizationId: string | null | undefined;
  instanceId?: string | null;
  enabled?: boolean;
}

const PAGE_SIZE = 1000;

export function useActiveConversations({
  organizationId,
  instanceId,
  enabled = true,
}: UseActiveConversationsArgs) {
  const query = useQuery({
    queryKey: ["active-conversations", organizationId, instanceId ?? null],
    queryFn: async (): Promise<ActiveConversationRow[]> => {
      if (!organizationId) return [];

      // 1) Pega todos os ids de contatos da org (RLS-safe)
      const contactIds: string[] = [];
      let from = 0;
      // Loop with safety cap of 10 pages = 10k contacts
      for (let page = 0; page < 10; page++) {
        const { data, error } = await supabase
          .from("contacts")
          .select("id")
          .eq("organization_id", organizationId)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const row of data) contactIds.push(row.id);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (contactIds.length === 0) return [];

      // 2) Conversas ativas desses contatos
      let convQuery = supabase
        .from("conversations")
        .select(
          "id, contact_id, instance_id, channel, last_message_at, last_message_preview, last_sender_type, unread_count, status, dm_window_expires_at, assigned_to, created_at, updated_at"
        )
        .in("contact_id", contactIds)
        .eq("status", "active")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(PAGE_SIZE);

      if (instanceId) {
        convQuery = convQuery.eq("instance_id", instanceId);
      }

      const { data, error } = await convQuery;
      if (error) throw error;
      return (data || []) as ActiveConversationRow[];
    },
    enabled: enabled && !!organizationId,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  return {
    conversations: query.data || [],
    count: query.data?.length || 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
