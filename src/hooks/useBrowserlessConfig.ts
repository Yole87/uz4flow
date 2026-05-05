import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useToast } from "@/hooks/use-toast";

interface BrowserlessConfig {
  isConfigured: boolean;
  maskedKey: string | null;
  lastTestAt: string | null;
  useStealthMode: boolean;
  useResidentialProxy: boolean;
  blockCount: number;
  lastBlockDetectedAt: string | null;
  preferredProvider: "scraping" | "places_api";
}

export function useBrowserlessConfig() {
  const { data: organization } = useUserOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["browserless-config", organization?.id],
    queryFn: async (): Promise<BrowserlessConfig> => {
      const { data, error } = await supabase.functions.invoke("manage-prospect-provider", {
        body: { action: "get" },
      });

      if (error) {
        console.error("Error fetching browserless config:", error);
        throw error;
      }

      return {
        isConfigured: data?.data?.browserless_configured ?? false,
        maskedKey: data?.data?.browserless_api_key_masked ?? null,
        lastTestAt: data?.data?.browserless_last_test_at ?? null,
        useStealthMode: data?.data?.use_stealth_mode ?? true,
        useResidentialProxy: data?.data?.use_residential_proxy ?? false,
        blockCount: data?.data?.block_count ?? 0,
        lastBlockDetectedAt: data?.data?.last_block_detected_at ?? null,
        preferredProvider: data?.data?.preferred_provider ?? "scraping",
      };
    },
    enabled: !!organization?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2, // Limitar retentativas para evitar loop infinito
    retryDelay: 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const { data, error } = await supabase.functions.invoke("manage-prospect-provider", {
        body: { action: "save-browserless", apiKey },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao salvar");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["browserless-config"] });
      toast({
        title: "Chave salva com sucesso",
        description: "Sua chave Browserless foi configurada.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar chave",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-prospect-provider", {
        body: { action: "test-browserless" },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao testar");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["browserless-config"] });
      toast({
        title: "Conexão verificada!",
        description: "Sua chave Browserless está funcionando corretamente.",
      });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["browserless-config"] });
      toast({
        title: "Erro ao testar conexão",
        description: error instanceof Error ? error.message : "Verifique sua chave",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-prospect-provider", {
        body: { action: "remove-browserless" },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao remover");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["browserless-config"] });
      toast({
        title: "Chave removida",
        description: "Configure uma nova chave para usar a prospecção.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover chave",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const updateAntiBlockMutation = useMutation({
    mutationFn: async (settings: { useStealthMode?: boolean; useResidentialProxy?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("manage-prospect-provider", {
        body: { action: "update-anti-block", ...settings },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao atualizar");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["browserless-config"] });
      toast({
        title: "Configuração salva",
        description: "Proteção anti-bloqueio atualizada.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    },
  });

  return {
    config: configQuery.data,
    isLoading: configQuery.isLoading,
    isError: configQuery.isError,
    error: configQuery.error,
    isConfigured: configQuery.data?.isConfigured ?? false,
    maskedKey: configQuery.data?.maskedKey,
    lastTestAt: configQuery.data?.lastTestAt,
    useStealthMode: configQuery.data?.useStealthMode ?? true,
    useResidentialProxy: configQuery.data?.useResidentialProxy ?? false,
    blockCount: configQuery.data?.blockCount ?? 0,
    lastBlockDetectedAt: configQuery.data?.lastBlockDetectedAt,
    preferredProvider: configQuery.data?.preferredProvider ?? "scraping",
    saveKey: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    testKey: testMutation.mutate,
    isTesting: testMutation.isPending,
    removeKey: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
    updateAntiBlock: updateAntiBlockMutation.mutate,
    isUpdatingAntiBlock: updateAntiBlockMutation.isPending,
    refetch: configQuery.refetch,
  };
}
