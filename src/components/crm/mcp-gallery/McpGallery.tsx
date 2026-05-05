import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useToast } from "@/hooks/use-toast";
import { McpProviderCard } from "./McpProviderCard";
import { McpConnectionCard } from "./McpConnectionCard";
import { GoogleDriveConnectDialog } from "./GoogleDriveConnectDialog";
import { GoogleDriveIcon } from "./GoogleDriveIcon";
import { useSearchParams } from "react-router-dom";

const PROVIDERS = [
  {
    id: "google_drive",
    name: "Google Drive",
    description: "Busque, liste e acesse arquivos do Drive",
    icon: <GoogleDriveIcon className="h-8 w-8" />,
    iconSmall: <GoogleDriveIcon className="h-5 w-5" />,
  },
];

export function McpGallery() {
  const { data: org } = useUserOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connectProvider, setConnectProvider] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle OAuth callback status
  useEffect(() => {
    const oauthStatus = searchParams.get("oauth_status");
    if (oauthStatus === "success") {
      toast({ title: "Google Drive conectado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["mcp-connections"] });
      searchParams.delete("oauth_status");
      setSearchParams(searchParams, { replace: true });
    } else if (oauthStatus === "error") {
      const reason = searchParams.get("reason") || "unknown";
      toast({
        title: "Erro ao conectar Google Drive",
        description: `Motivo: ${reason}`,
        variant: "destructive",
      });
      searchParams.delete("oauth_status");
      searchParams.delete("reason");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  interface McpConnectionSafe {
    id: string;
    organization_id: string;
    provider: string;
    description: string | null;
    is_active: boolean;
    scopes: string | null;
    token_expiry: string | null;
    created_at: string;
    updated_at: string;
    has_access_token: boolean;
    has_refresh_token: boolean;
  }

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["mcp-connections", org?.id],
    queryFn: async (): Promise<McpConnectionSafe[]> => {
      if (!org?.id) return [];
      const { data, error } = await supabase
        .from("mcp_connections_safe" as any)
        .select("*")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as McpConnectionSafe[];
    },
    enabled: !!org?.id,
  });

  const handleGoogleDriveConnect = () => {
    if (!org?.id) {
      toast({ title: "Organização não encontrada", variant: "destructive" });
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    // OAuth Client ID is a public/publishable key (visible in every OAuth redirect URL)
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "1062509097944-u4kjmnekmujoprmcjf3e8bqnefoqut1vrn.apps.googleusercontent.com";
    const redirectUri = `${supabaseUrl}/functions/v1/gdrive-oauth-callback`;
    const scope = "https://www.googleapis.com/auth/drive.readonly";

    // Encode state with org_id and redirect URL
    const state = btoa(JSON.stringify({
      org_id: org.id,
      redirect_url: window.location.origin + "/mcp-gateway",
    }));

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    setConnectProvider(null);
    window.location.href = authUrl.toString();
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("mcp_connections")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mcp-connections"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mcp_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-connections"] });
      toast({ title: "Conexão removida" });
    },
  });

  const providerMeta = (provider: string) =>
    PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Available providers */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Provedores Disponíveis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDERS.map((p) => (
            <McpProviderCard
              key={p.id}
              name={p.name}
              description={p.description}
              icon={p.icon}
              onConnect={() => setConnectProvider(p.id)}
            />
          ))}
        </div>
      </section>

      {/* Active connections */}
      {connections.length > 0 && (
        <section>
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Conexões Ativas</h2>
          <div className="space-y-3">
            {connections.map((c) => {
              const meta = providerMeta(c.provider);
              return (
                <McpConnectionCard
                  key={c.id}
                  provider={meta.name}
                  description={c.description}
                  isActive={c.is_active}
                  icon={meta.iconSmall}
                  onToggle={(active) => toggleMutation.mutate({ id: c.id, isActive: active })}
                  onRemove={() => removeMutation.mutate(c.id)}
                />
              );
            })}
          </div>
        </section>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      )}

      {/* Google Drive OAuth dialog */}
      <GoogleDriveConnectDialog
        open={connectProvider === "google_drive"}
        onOpenChange={(open) => !open && setConnectProvider(null)}
        onConnect={handleGoogleDriveConnect}
      />
    </div>
  );
}
