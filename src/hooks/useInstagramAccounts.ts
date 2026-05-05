import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useInstagramConfig } from "@/hooks/useInstagramConfig";
import { toast } from "sonner";

export interface InstagramAccount {
  id: string;
  username: string | null;
  ig_user_id: string;
  page_id: string;
  token_status: string;
  token_expires_at: string | null;
  profile_picture_url: string | null;
  scopes: string | null;
  created_at: string;
  updated_at: string;
}

export function useInstagramAccounts() {
  const queryClient = useQueryClient();
  const { data: org } = useUserOrganization();
  const { embeddedLoginUrl } = useInstagramConfig();

  const accountsQuery = useQuery({
    queryKey: ["instagram-accounts", org?.id],
    queryFn: async () => {
      if (!org?.id) return [];
      const { data, error } = await supabase
        .from("instagram_accounts")
        .select("id, username, ig_user_id, page_id, token_status, token_expires_at, profile_picture_url, scopes, created_at, updated_at")
        .eq("organization_id", org.id)
        .neq("token_status", "revoked")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InstagramAccount[];
    },
    enabled: !!org?.id,
  });

  const startOAuth = async () => {
    if (!org?.id) {
      toast.error("Organização não encontrada");
      return;
    }

    // If embedded login URL is configured, append state param and force account reauth
    if (embeddedLoginUrl) {
      const state = btoa(JSON.stringify({
        org_id: org.id,
        redirect_url: window.location.origin + "/instagram",
      }));
      const urlObj = new URL(embeddedLoginUrl);
      urlObj.searchParams.set("state", state);
      urlObj.searchParams.set("force_reauth", "true");
      urlObj.searchParams.set("enable_fb_login", "false");
      window.location.href = urlObj.toString();
      return;
    }

    // Fallback to programmatic OAuth start
    const oauthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-oauth?action=start&organization_id=${org.id}&redirect_url=${encodeURIComponent(window.location.origin + "/instagram")}`;
    window.location.href = oauthUrl;
  };

  const refreshToken = useMutation({
    mutationFn: async (accountId: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Não autenticado");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-oauth?action=refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({ account_id: accountId }),
        }
      );
      if (!res.ok) throw new Error("Falha ao renovar token");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-accounts"] });
      toast.success("Token renovado com sucesso!");
    },
    onError: () => toast.error("Erro ao renovar token"),
  });

  const disconnectAccount = useMutation({
    mutationFn: async (accountId: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Não autenticado");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-oauth?action=disconnect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({ account_id: accountId }),
        }
      );
      if (!res.ok) throw new Error("Falha ao desconectar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-accounts"] });
      toast.success("Conta desconectada!");
    },
    onError: () => toast.error("Erro ao desconectar conta"),
  });

  return {
    accounts: accountsQuery.data ?? [],
    isLoading: accountsQuery.isLoading,
    startOAuth,
    refreshToken,
    disconnectAccount,
  };
}
