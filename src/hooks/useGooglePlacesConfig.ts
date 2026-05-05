import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useToast } from "@/hooks/use-toast";

interface GooglePlacesConfig {
  isConfigured: boolean;
  maskedKey: string | null;
  lastTestAt: string | null;
  preferredProvider: "scraping" | "places_api";
}

export function useGooglePlacesConfig() {
  const { data: organization } = useUserOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["google-places-config", organization?.id],
    queryFn: async (): Promise<GooglePlacesConfig> => {
      const { data, error } = await supabase.functions.invoke("manage-prospect-provider", {
        body: { action: "get" },
      });

      if (error) {
        console.error("Error fetching google places config:", error);
        throw error;
      }

      return {
        isConfigured: data?.data?.google_places_configured ?? false,
        maskedKey: data?.data?.google_places_api_key_masked ?? null,
        lastTestAt: data?.data?.google_places_last_test_at ?? null,
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
        body: { action: "save-google-places", apiKey },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao salvar");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-places-config"] });
      queryClient.invalidateQueries({ queryKey: ["browserless-config"] });
      toast({
        title: "Chave salva com sucesso",
        description: "Sua chave Google Places API foi configurada.",
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
        body: { action: "test-google-places" },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao testar");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-places-config"] });
      toast({
        title: "Conexão verificada!",
        description: "Sua chave Google Places API está funcionando corretamente.",
      });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["google-places-config"] });
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
        body: { action: "remove-google-places" },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao remover");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-places-config"] });
      queryClient.invalidateQueries({ queryKey: ["browserless-config"] });
      toast({
        title: "Chave removida",
        description: "Configure uma nova chave para usar a Google Places API.",
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

  const setPreferredProviderMutation = useMutation({
    mutationFn: async (provider: "scraping" | "places_api") => {
      const { data, error } = await supabase.functions.invoke("manage-prospect-provider", {
        body: { action: "set-preferred-provider", provider },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao atualizar");

      return data;
    },
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: ["google-places-config"] });
      queryClient.invalidateQueries({ queryKey: ["browserless-config"] });
      toast({
        title: "Método atualizado",
        description: provider === "places_api" 
          ? "Usando Google Places API (Premium)" 
          : "Usando Scraping (Gratuito)",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar método",
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
    preferredProvider: configQuery.data?.preferredProvider ?? "scraping",
    saveKey: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    testKey: testMutation.mutate,
    isTesting: testMutation.isPending,
    removeKey: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
    setPreferredProvider: setPreferredProviderMutation.mutate,
    isSettingProvider: setPreferredProviderMutation.isPending,
    refetch: configQuery.refetch,
  };
}
