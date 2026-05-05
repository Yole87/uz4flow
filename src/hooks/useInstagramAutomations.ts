import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { toast } from "sonner";

export interface InstagramAutomation {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  is_enabled: boolean;
  definition_json: any;
  execution_count: number;
  last_executed_at: string | null;
  account_id: string | null;
  created_at: string;
  updated_at: string;
}

async function callApi(action: string, body: Record<string, any> = {}) {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) throw new Error("Não autenticado");
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-automations-api`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({ action, ...body }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro na requisição");
  }
  return res.json();
}

export function useInstagramAutomations() {
  const queryClient = useQueryClient();
  const { data: org } = useUserOrganization();

  const automationsQuery = useQuery({
    queryKey: ["instagram-automations", org?.id],
    queryFn: () => callApi("automations/list"),
    enabled: !!org?.id,
    select: (data) => (data.automations ?? []) as InstagramAutomation[],
  });

  const createAutomation = useMutation({
    mutationFn: (payload: any) => callApi("automations/create", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-automations"] });
      toast.success("Automação criada!");
    },
    onError: () => toast.error("Erro ao criar automação"),
  });

  const updateAutomation = useMutation({
    mutationFn: (payload: any) => callApi("automations/update", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-automations"] });
      toast.success("Automação atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar automação"),
  });

  const deleteAutomation = useMutation({
    mutationFn: (id: string) => callApi("automations/delete", { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-automations"] });
      toast.success("Automação excluída!");
    },
    onError: () => toast.error("Erro ao excluir automação"),
  });

  const toggleAutomation = useMutation({
    mutationFn: ({ id, is_enabled }: { id: string; is_enabled: boolean }) =>
      callApi("automations/toggle", { id, is_enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-automations"] });
    },
    onError: () => toast.error("Erro ao alterar automação"),
  });

  const simulateAutomation = useMutation({
    mutationFn: ({ id, mock_text }: { id: string; mock_text: string }) =>
      callApi("simulate", { automation_id: id, mock_text }),
  });

  // Templates
  const templatesQuery = useQuery({
    queryKey: ["instagram-templates", org?.id],
    queryFn: () => callApi("templates/list"),
    enabled: !!org?.id,
    select: (data) => (data.templates ?? []) as any[],
  });

  const createTemplate = useMutation({
    mutationFn: (payload: any) => callApi("templates/create", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-templates"] });
      toast.success("Template criado!");
    },
    onError: () => toast.error("Erro ao criar template"),
  });

  const updateTemplate = useMutation({
    mutationFn: (payload: any) => callApi("templates/update", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-templates"] });
      toast.success("Template atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar template"),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => callApi("templates/delete", { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-templates"] });
      toast.success("Template excluído!");
    },
    onError: () => toast.error("Erro ao excluir template"),
  });

  return {
    automations: automationsQuery.data ?? [],
    isLoadingAutomations: automationsQuery.isLoading,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
    simulateAutomation,
    templates: templatesQuery.data ?? [],
    isLoadingTemplates: templatesQuery.isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
