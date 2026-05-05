import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useToast } from "@/hooks/use-toast";
import { getImpersonatedOrgId } from "@/hooks/useImpersonation";

interface InstagramAppConfig {
  appId: string | null;
  appSecretMasked: string | null;
  webhookVerifyToken: string | null;
  isConfigured: boolean;
  redirectUri: string;
  webhookUrl: string;
  embeddedLoginUrl: string | null;
  deauthorizationCallbackUrl: string;
  dataDeletionUrl: string;
}

export function useInstagramConfig() {
  const { data: organization } = useUserOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const impersonatedOrgId = getImpersonatedOrgId();

  const getBody = (extra: Record<string, unknown> = {}) => ({
    ...extra,
    ...(impersonatedOrgId ? { impersonate_org_id: impersonatedOrgId } : {}),
  });

  const configQuery = useQuery({
    queryKey: ["instagram-app-config", organization?.id, impersonatedOrgId],
    queryFn: async (): Promise<InstagramAppConfig> => {
      const { data, error } = await supabase.functions.invoke("manage-instagram-config", {
        body: getBody({ action: "get" }),
      });

      if (error) throw error;

      return {
        appId: data?.data?.app_id ?? null,
        appSecretMasked: data?.data?.app_secret_masked ?? null,
        webhookVerifyToken: data?.data?.webhook_verify_token ?? null,
        isConfigured: data?.data?.is_configured ?? false,
        redirectUri: data?.redirect_uri ?? "",
        webhookUrl: data?.webhook_url ?? "",
        embeddedLoginUrl: data?.data?.embedded_login_url ?? null,
        deauthorizationCallbackUrl: data?.deauthorization_callback_url ?? "",
        dataDeletionUrl: data?.data_deletion_url ?? "",
      };
    },
    enabled: !!organization?.id,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    retryDelay: 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (params: { appId: string; appSecret: string; webhookVerifyToken?: string; embeddedLoginUrl?: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-instagram-config", {
        body: getBody({ action: "save", ...params }),
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao salvar");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-app-config"] });
      toast({
        title: "Configuração salva",
        description: "Credenciais do Instagram configuradas com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-instagram-config", {
        body: getBody({ action: "test" }),
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha no teste");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: data.partial ? "Credenciais salvas ✓" : "Credenciais válidas ✓",
        description: data.message || "App ID e App Secret estão corretos.",
        variant: data.partial ? "default" : "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Teste falhou",
        description: error instanceof Error ? error.message : "Verifique as credenciais e tente novamente",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-instagram-config", {
        body: getBody({ action: "remove" }),
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao remover");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-app-config"] });
      toast({
        title: "Configuração removida",
        description: "As credenciais do Instagram foram removidas.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    },
  });

  return {
    config: configQuery.data,
    isLoading: configQuery.isLoading,
    isError: configQuery.isError,
    isConfigured: configQuery.data?.isConfigured ?? false,
    appId: configQuery.data?.appId,
    appSecretMasked: configQuery.data?.appSecretMasked,
    webhookVerifyToken: configQuery.data?.webhookVerifyToken,
    redirectUri: configQuery.data?.redirectUri ?? "",
    webhookUrl: configQuery.data?.webhookUrl ?? "",
    embeddedLoginUrl: configQuery.data?.embeddedLoginUrl ?? null,
    deauthorizationCallbackUrl: configQuery.data?.deauthorizationCallbackUrl ?? "",
    dataDeletionUrl: configQuery.data?.dataDeletionUrl ?? "",
    saveConfig: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    testConfig: testMutation.mutate,
    isTesting: testMutation.isPending,
    removeConfig: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
    refetch: configQuery.refetch,
  };
}
