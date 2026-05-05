import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstagramAccountsTab } from "@/components/instagram/InstagramAccountsTab";
import { InstagramAutomationsTab } from "@/components/instagram/InstagramAutomationsTab";
import { InstagramTemplatesTab } from "@/components/instagram/InstagramTemplatesTab";
import { InstagramLogsTab } from "@/components/instagram/InstagramLogsTab";
import { InstagramConfigTab } from "@/components/instagram/InstagramConfigTab";
import { InstagramInsightsTab } from "@/components/instagram/InstagramInsightsTab";
import { Instagram, Bot, FileText, ListChecks, Settings, BarChart3 } from "lucide-react";
import { LimitAlert } from "@/components/LimitAlert";
import { toast } from "@/hooks/use-toast";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  long_token_failed: "A Meta recusou a etapa final do token. Revise se a conta é profissional e se o app está liberado para ela.",
  app_access_limited: "Esta conta não está autorizada no seu app Meta. Em modo Desenvolvimento, cada conta precisa ser adicionada como Testador no Meta for Developers (etapa 2 – Gerar tokens de acesso). Para permitir qualquer conta sem cadastro prévio, publique o app e solicite Advanced Access (etapa 5).",
  token_exchange_failed: "Falha ao trocar o código de autorização. Verifique se o App Secret e a URI de redirecionamento estão corretos nas configurações.",
  redirect_uri_mismatch: "A URI de redirecionamento cadastrada no app Meta não corresponde à URI do sistema. Vá em Configurações → Instagram e copie a URI exata exibida para colar no painel da Meta.",
  invalid_app_secret: "O App Secret informado não corresponde ao Instagram App ID. Verifique se ambos pertencem ao mesmo aplicativo na Meta for Developers.",
  invalid_app_id: "O Instagram App ID informado é inválido ou não pertence ao aplicativo configurado. Verifique nas configurações.",
  code_expired_or_reused: "O código de autorização expirou ou já foi utilizado. Tente conectar novamente.",
  oauth_exception: "Erro de autenticação na Meta. Verifique se o App ID, App Secret e URI de redirecionamento estão configurados corretamente e pertencem ao mesmo aplicativo.",
  profile_fetch_failed: "Não foi possível buscar o perfil do Instagram. Verifique as permissões do app.",
  missing_params: "Parâmetros ausentes no retorno do Instagram. Tente conectar novamente.",
  codigo_ausente: "O Instagram não retornou o código de autorização. Tente conectar novamente.",
  organizacao_nao_identificada: "Não foi possível identificar sua organização. Tente conectar novamente pela página de configurações.",
  credenciais_nao_encontradas: "Credenciais do Instagram não encontradas. Configure o App ID e App Secret antes de conectar.",
  invalid_state: "Dados de autenticação inválidos. Tente conectar novamente.",
  no_credentials: "App do Instagram não configurado. Vá em Configurações e insira suas credenciais.",
  access_denied: "Acesso negado pelo Instagram. Verifique as permissões e tente novamente.",
};

export default function InstagramPage() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Handle tab switching via search params (e.g. from accounts tab redirect)
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["accounts", "automations", "templates", "insights", "logs", "config"].includes(tab)) {
      setActiveTab(tab);
      searchParams.delete("tab");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Forward OAuth code/state to edge function if Meta redirected here directly
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (code) {
      const params = new URLSearchParams();
      params.set("code", code);
      if (state) params.set("state", state);
      const edgeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-oauth?${params.toString()}`;
      window.location.href = edgeUrl;
    }
  }, [searchParams]);

  useEffect(() => {
    const igOauth = searchParams.get("ig_oauth");
    if (!igOauth) return;

    const reason = searchParams.get("reason") || "";

    if (igOauth === "success") {
      toast({ title: "Instagram conectado!", description: "Conta vinculada com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["instagram-accounts"] });
    } else if (igOauth === "error") {
      toast({
        title: "Erro ao conectar Instagram",
        description: OAUTH_ERROR_MESSAGES[reason] || `Erro: ${reason || "desconhecido"}`,
        variant: "destructive",
      });
    }

    // Clean query params
    searchParams.delete("ig_oauth");
    searchParams.delete("reason");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, queryClient]);

  return (
    <AppLayout title="Instagram" description="Gerencie contas, automações e templates do Instagram">
      <div className="space-y-6 animate-fade-in">
        <LimitAlert feature="automations" className="mb-2" />
        <div className="flex items-center gap-2 mb-2 min-w-0">
          <Instagram className="h-5 w-5 text-accent shrink-0" />
          <h2 className="text-lg font-semibold text-foreground truncate whitespace-nowrap">Automações Instagram</h2>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
            <TabsTrigger value="accounts" className="gap-1.5 shrink-0 text-xs sm:text-sm">
              <Instagram className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Contas</span>
              <span className="sm:hidden">Contas</span>
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-1.5 shrink-0 text-xs sm:text-sm">
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Automações</span>
              <span className="sm:hidden">Auto.</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5 shrink-0 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1.5 shrink-0 text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5 shrink-0 text-xs sm:text-sm">
              <ListChecks className="h-3.5 w-3.5" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5 shrink-0 text-xs sm:text-sm">
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Configurações</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts">
            <InstagramAccountsTab />
          </TabsContent>
          <TabsContent value="automations">
            <InstagramAutomationsTab />
          </TabsContent>
          <TabsContent value="templates">
            <InstagramTemplatesTab />
          </TabsContent>
          <TabsContent value="insights">
            <InstagramInsightsTab />
          </TabsContent>
          <TabsContent value="logs">
            <InstagramLogsTab />
          </TabsContent>
          <TabsContent value="config">
            <InstagramConfigTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
