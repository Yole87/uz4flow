import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { toast } from "sonner";

export interface SmartLabel {
  id: string;
  organization_id: string;
  key: string;
  name: string;
  color: string;
  icon: string | null;
  order_index: number;
  is_system: boolean;
}

export function useSmartLabels() {
  const { data: org } = useUserOrganization();
  const queryClient = useQueryClient();
  const orgId = org?.id;

  const query = useQuery({
    queryKey: ["smart-labels", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("smart_labels" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("order_index");
      if (error) throw error;
      return (data || []) as unknown as SmartLabel[];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; color: string; icon?: string }) => {
      if (!orgId) throw new Error("Sem organização");
      const key = input.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      const { error } = await supabase.from("smart_labels" as any).insert({
        organization_id: orgId,
        key,
        name: input.name,
        color: input.color,
        icon: input.icon || null,
        is_system: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart-labels", orgId] });
      toast.success("Etiqueta criada");
    },
    onError: (e: any) => toast.error(e?.message?.includes("duplicate") ? "Já existe etiqueta com esse nome" : "Erro ao criar etiqueta"),
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; name?: string; color?: string; icon?: string | null }) => {
      const patch: Record<string, any> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.color !== undefined) patch.color = input.color;
      if (input.icon !== undefined) patch.icon = input.icon;
      const { error } = await supabase.from("smart_labels" as any).update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart-labels", orgId] });
      toast.success("Etiqueta atualizada");
    },
    onError: () => toast.error("Erro ao atualizar etiqueta"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("smart_labels" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart-labels", orgId] });
      toast.success("Etiqueta excluída");
    },
    onError: () => toast.error("Não foi possível excluir (etiquetas do sistema são protegidas)"),
  });

  const toggleOnContact = useMutation({
    mutationFn: async (input: { contactId: string; key: string; enabled: boolean }) => {
      // Fetch current
      const { data: current, error: fetchErr } = await supabase
        .from("contacts")
        .select("smart_label_keys")
        .eq("id", input.contactId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      const existing: string[] = (current as any)?.smart_label_keys || [];
      const next = input.enabled
        ? Array.from(new Set([...existing, input.key]))
        : existing.filter((k) => k !== input.key);
      const { error } = await supabase
        .from("contacts")
        .update({ smart_label_keys: next } as any)
        .eq("id", input.contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contact"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-contacts"] });
    },
    onError: () => toast.error("Erro ao atualizar etiqueta do contato"),
  });

  return {
    labels: query.data || [],
    isLoading: query.isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    toggleOnContact: toggleOnContact.mutateAsync,
  };
}
