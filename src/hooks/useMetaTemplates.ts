import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MetaTemplate {
  id: string;
  instance_id: string;
  template_name: string;
  template_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useMetaTemplates(instanceId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["meta-templates", instanceId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from("meta_templates" as any)
        .select("*")
        .eq("instance_id", instanceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MetaTemplate[];
    },
    enabled: !!instanceId,
  });

  const addTemplate = useMutation({
    mutationFn: async (input: { template_name: string; template_message?: string }) => {
      if (!instanceId) throw new Error("No instance");
      const { error } = await (supabase as any)
        .from("meta_templates")
        .insert({ instance_id: instanceId, ...input });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("meta_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { templates: query.data ?? [], isLoading: query.isLoading, addTemplate, deleteTemplate };
}
