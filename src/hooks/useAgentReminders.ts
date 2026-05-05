import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { toast } from "sonner";

export interface AgentReminder {
  id: string;
  user_id: string;
  organization_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  description: string;
  remind_at: string;
  status: "pending" | "done" | "dismissed";
  notified_at: string | null;
  created_at: string;
  updated_at: string;
  contact?: { id: string; name: string | null; phone: string | null } | null;
}

export function useAgentReminders(contactId?: string, options?: { includeAllStatuses?: boolean }) {
  const { user } = useAuth();
  const { data: org } = useUserOrganization();
  const queryClient = useQueryClient();
  const firedToastIds = useRef<Set<string>>(new Set());

  const includeAllStatuses = !!options?.includeAllStatuses;

  const query = useQuery({
    queryKey: ["agent-reminders", user?.id, contactId ?? "all", includeAllStatuses ? "all-status" : "pending"],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase
        .from("agent_reminders" as any)
        .select("*, contact:contacts(id, name, phone)")
        .eq("user_id", user.id)
        .order("remind_at", { ascending: true });
      if (!includeAllStatuses) q = q.eq("status", "pending");
      if (contactId) q = q.eq("contact_id", contactId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as AgentReminder[];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  // Realtime: listen for inserts/updates on own reminders
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`agent-reminders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_reminders", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["agent-reminders", user.id] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const setStatusMutation = useMutation({
    mutationFn: async (input: { id: string; status: "done" | "dismissed" }) => {
      const { error } = await supabase
        .from("agent_reminders" as any)
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-reminders"] }),
    onError: () => toast.error("Erro ao atualizar lembrete"),
  });

  // Browser notification when due — guarded by useRef to avoid duplicate toasts on refetch
  useEffect(() => {
    if (!query.data || query.data.length === 0) return;
    const timers: number[] = [];
    const now = Date.now();

    const fireToast = (r: AgentReminder, overdue: boolean) => {
      if (firedToastIds.current.has(r.id)) return;
      firedToastIds.current.add(r.id);
      const name = r.contact?.name || r.contact?.phone || "contato";
      const title = overdue ? `🔔 Lembrete vencido: ${r.description}` : `🔔 Lembrete: ${r.description}`;
      toast.warning(title, {
        description: `Sobre: ${name}`,
        duration: 30_000,
        action: {
          label: "✓ Concluir",
          onClick: () => setStatusMutation.mutate({ id: r.id, status: "done" }),
        },
        cancel: {
          label: "✗ Dispensar",
          onClick: () => setStatusMutation.mutate({ id: r.id, status: "dismissed" }),
        },
      });
      // Mark notified in DB
      supabase
        .from("agent_reminders" as any)
        .update({ notified_at: new Date().toISOString() })
        .eq("id", r.id)
        .then(() => queryClient.invalidateQueries({ queryKey: ["agent-reminders", user?.id] }));
    };

    query.data.forEach((r) => {
      if (r.notified_at) {
        // Already notified previously — track to prevent re-firing in this session too
        firedToastIds.current.add(r.id);
        return;
      }
      const due = new Date(r.remind_at).getTime();
      const delay = due - now;
      if (delay > 0 && delay < 24 * 3600 * 1000) {
        const id = window.setTimeout(() => fireToast(r, false), delay);
        timers.push(id);
      } else if (delay <= 0) {
        fireToast(r, true);
      }
    });

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [query.data, user, queryClient, setStatusMutation]);

  const create = useMutation({
    mutationFn: async (input: {
      contact_id?: string | null;
      conversation_id?: string | null;
      description: string;
      remind_at: string;
    }) => {
      if (!user || !org) throw new Error("Não autenticado");
      const { error } = await supabase.from("agent_reminders" as any).insert({
        user_id: user.id,
        organization_id: org.id,
        contact_id: input.contact_id || null,
        conversation_id: input.conversation_id || null,
        description: input.description,
        remind_at: input.remind_at,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-reminders"] });
      toast.success("Lembrete criado");
    },
    onError: () => toast.error("Erro ao criar lembrete"),
  });

  const update = useMutation({
    mutationFn: async (input: {
      id: string;
      description: string;
      remind_at: string;
    }) => {
      const { error } = await supabase
        .from("agent_reminders" as any)
        .update({
          description: input.description,
          remind_at: input.remind_at,
          notified_at: null, // reset so toast fires again at new time
        })
        .eq("id", input.id);
      if (error) throw error;
      // Allow toast to fire again for this updated reminder
      firedToastIds.current.delete(input.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-reminders"] });
      toast.success("Lembrete atualizado");
    },
    onError: () => toast.error("Erro ao atualizar lembrete"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_reminders" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-reminders"] });
      toast.success("Lembrete removido");
    },
    onError: () => toast.error("Erro ao remover lembrete"),
  });

  return {
    reminders: query.data || [],
    isLoading: query.isLoading,
    create: create.mutateAsync,
    update: update.mutateAsync,
    setStatus: setStatusMutation.mutateAsync,
    remove: remove.mutateAsync,
    isCreating: create.isPending,
    isUpdating: update.isPending,
  };
}
