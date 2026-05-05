import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useBrowserlessConfig } from "@/hooks/useBrowserlessConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceConfigSection } from "@/components/settings/ServiceConfigSection";
import { type TutorialStep } from "@/components/settings/ServiceTutorialSteps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Map, 
  Check, 
  Loader2,
  Phone,
  Users,
  Search,
  Zap,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  Trash2,
  Target,
  Shield,
  Globe,
  UserSearch
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GooglePlacesConfigCard } from "./GooglePlacesConfigCard";
import { ProviderMethodSelector } from "./ProviderMethodSelector";

interface ProspectionStats {
  totalSearches: number;
  totalLeads: number;
  leadsWithPhone: number;
  leadsWithWhatsApp: number;
}

export function ProviderConfigCard() {
  const { data: organization } = useUserOrganization();
  const {
    isConfigured,
    maskedKey,
    lastTestAt,
    isLoading: isLoadingConfig,
    isError: isConfigError,
    saveKey,
    isSaving,
    testKey,
    isTesting,
    removeKey,
    isRemoving,
    useStealthMode,
    useResidentialProxy,
    blockCount,
    updateAntiBlock,
    isUpdatingAntiBlock,
    refetch: refetchConfig,
  } = useBrowserlessConfig();

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["prospection-stats", organization?.id],
    queryFn: async (): Promise<ProspectionStats> => {
      if (!organization?.id) {
        return { totalSearches: 0, totalLeads: 0, leadsWithPhone: 0, leadsWithWhatsApp: 0 };
      }
      const [searchesResult, leadsResult, phonesResult, whatsappResult] = await Promise.all([
        supabase.from("prospect_searches").select("*", { count: "exact", head: true }).eq("organization_id", organization.id),
        supabase.from("prospect_results").select("*", { count: "exact", head: true }).eq("organization_id", organization.id),
        supabase.from("prospect_results").select("*", { count: "exact", head: true }).eq("organization_id", organization.id).not("phone", "is", null),
        supabase.from("prospect_results").select("*", { count: "exact", head: true }).eq("organization_id", organization.id).eq("has_whatsapp", true),
      ]);
      return {
        totalSearches: searchesResult.count || 0,
        totalLeads: leadsResult.count || 0,
        leadsWithPhone: phonesResult.count || 0,
        leadsWithWhatsApp: whatsappResult.count || 0,
      };
    },
    enabled: !!organization?.id,
  });

  const phoneRate = stats && stats.totalLeads > 0 ? Math.round((stats.leadsWithPhone / stats.totalLeads) * 100) : 0;
  const whatsappRate = stats && stats.totalLeads > 0 ? Math.round((stats.leadsWithWhatsApp / stats.totalLeads) * 100) : 0;

  const handleSaveKey = () => {
    if (apiKeyInput.trim().length >= 10) {
      saveKey(apiKeyInput.trim());
      setApiKeyInput("");
      setShowInput(false);
    }
  };

  const handleRemoveKey = () => {
    if (confirm("Tem certeza que deseja remover a chave Browserless? Você não poderá usar a prospecção até configurar uma nova chave.")) {
      removeKey();
    }
  };

  if (isConfigError) {
    return (
      <div className="space-y-6 w-full">
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <div className="text-center">
              <p className="text-destructive font-medium">Erro ao carregar configurações</p>
              <p className="text-muted-foreground text-sm mt-1">
                Não foi possível conectar ao servidor. Tente novamente.
              </p>
            </div>
            <Button
              onClick={() => refetchConfig()}
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingConfig || isLoadingStats) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const prospectionTutorialSteps: TutorialStep[] = [
    {
      title: "Crie uma conta no Browserless",
      description:
        "Acesse browserless.io, crie uma conta gratuita e obtenha sua API Key. O plano gratuito inclui 1.000 unidades por mês, suficiente para dezenas de buscas.",
    },
    {
      title: "Copie sua API Key do Browserless",
      description:
        'No painel do Browserless, vá em "Account" → "API Key". Copie a chave completa.',
    },
    {
      title: "Cole a chave no campo acima",
      description:
        'Cole sua chave Browserless no campo "API Key" na seção de credenciais acima e clique em "Salvar". Use o botão "Testar" para verificar se está funcionando.',
    },
    {
      title: "(Opcional) Configure a Google Places API",
      description:
        'Acesse console.cloud.google.com, crie um projeto, ative a "Places API (New)" e gere uma chave de API. Cole a chave no campo correspondente. O Google oferece $200/mês de crédito gratuito.',
    },
    {
      title: "Escolha o método de busca",
      description:
        'No seletor "Método de Busca Ativo", escolha entre Scraping (gratuito, mais lento) ou Google Places API (rápido, custo por busca). Você pode alternar a qualquer momento.',
    },
  ];

  return (
    <ServiceConfigSection
      title="Prospecção de IA"
      icon={UserSearch}
      tutorialVideoId="rO4rkil-qLk"
      tutorialVideoTitle="Como configurar a Prospecção de IA"
      tutorialSteps={prospectionTutorialSteps}
    >
      <ProviderMethodSelector />

      {/* Configuração Browserless */}
      <Card className={`border-border ${!isConfigured ? 'border-warning/50' : ''}`}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2 flex-wrap">
                <Key className="h-5 w-5 text-accent" />
                Chave Browserless API
                <Badge className="bg-accent/20 text-accent border-accent/30 text-xs">
                  Gratuito*
                </Badge>
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Para usar o método de scraping do Google Maps
              </CardDescription>
            </div>
            {isConfigured ? (
              <Badge className="bg-success/20 text-success border-success/30 self-start sm:self-auto">
                <Check className="h-3 w-3 mr-1" /> Configurado
              </Badge>
            ) : (
              <Badge className="bg-warning/20 text-warning border-warning/30 self-start sm:self-auto">
                <AlertTriangle className="h-3 w-3 mr-1" /> Pendente
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConfigured ? (
            <>
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Configuração necessária</p>
                    <p className="text-xs opacity-80 mt-1">
                      Para usar a prospecção via scraping, você precisa configurar sua própria chave Browserless API.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">API Key</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        placeholder="Cole sua chave Browserless aqui"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        className="bg-muted border-border text-foreground pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      onClick={handleSaveKey}
                      disabled={isSaving || apiKeyInput.trim().length < 10}
                      className="gradient-primary hover:opacity-90 text-primary-foreground"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <a
                    href="https://browserless.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-accent hover:text-accent/80"
                  >
                    Obter chave no Browserless.io
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span>•</span>
                  <span>O plano gratuito inclui 1.000 unidades/mês</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-muted rounded-lg border border-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                      <Key className="h-5 w-5 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">API Key</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{maskedKey || "••••••••"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testKey()}
                      disabled={isTesting}
                      className="border-border text-foreground hover:bg-muted"
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-2">Testar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveKey}
                      disabled={isRemoving}
                      className="border-border text-foreground hover:bg-destructive/20 hover:border-destructive/50 hover:text-destructive"
                    >
                      {isRemoving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {lastTestAt && (
                  <p className="text-xs text-muted-foreground">
                    Última verificação: {formatDistanceToNow(new Date(lastTestAt), { addSuffix: true, locale: ptBR })}
                  </p>
                )}
              </div>

              {showInput && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Nova API Key</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="password"
                      placeholder="Cole a nova chave"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="bg-muted border-border text-foreground"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveKey}
                        disabled={isSaving || apiKeyInput.trim().length < 10}
                        className="gradient-primary hover:opacity-90 text-primary-foreground"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setShowInput(false); setApiKeyInput(""); }}
                        className="border-border text-foreground hover:bg-muted"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!showInput && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInput(true)}
                  className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Alterar chave
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Google Places API Config */}
      <GooglePlacesConfigCard />

      {/* Proteção Anti-Bloqueio */}
      {isConfigured && (
        <Card className="border-border">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2 flex-wrap">
                  <Shield className="h-5 w-5 text-secondary" />
                  Proteção Anti-Bloqueio
                  <Badge className="bg-muted text-muted-foreground border-border text-xs">
                    Scraping
                  </Badge>
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Evite bloqueios e CAPTCHAs durante a extração via scraping
                </CardDescription>
              </div>
              {blockCount > 0 && (
                <Badge className="bg-warning/20 text-warning border-warning/30 self-start sm:self-auto">
                  {blockCount} bloqueio{blockCount !== 1 ? "s" : ""} detectado{blockCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg border border-border space-y-4">
              {/* Stealth Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Modo Stealth</p>
                    <p className="text-xs text-muted-foreground">User-Agent rotativo e evasão de detecção</p>
                  </div>
                </div>
                <Switch
                  checked={useStealthMode}
                  onCheckedChange={(checked) => updateAntiBlock({ useStealthMode: checked })}
                  disabled={isUpdatingAntiBlock}
                />
              </div>

              {/* Residential Proxy Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Proxy Residencial</p>
                    <p className="text-xs text-muted-foreground">IP brasileiro real (+5 unidades/busca)</p>
                  </div>
                </div>
                <Switch
                  checked={useResidentialProxy}
                  onCheckedChange={(checked) => updateAntiBlock({ useResidentialProxy: checked })}
                  disabled={isUpdatingAntiBlock}
                />
              </div>
            </div>

            <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-lg text-secondary text-sm">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Dica de uso</p>
                  <p className="text-xs opacity-80 mt-1">
                    O Modo Stealth é suficiente para a maioria dos casos. Ative o Proxy Residencial apenas se estiver enfrentando bloqueios frequentes.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-secondary" />
            Estatísticas da Organização
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Resumo das suas atividades de prospecção
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg border border-border text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.totalSearches || 0}</p>
              <p className="text-xs text-muted-foreground">Buscas realizadas</p>
            </div>
            
            <div className="p-4 bg-muted rounded-lg border border-border text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.totalLeads || 0}</p>
              <p className="text-xs text-muted-foreground">Leads encontrados</p>
            </div>
            
            <div className="p-4 bg-muted rounded-lg border border-border text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-accent">{phoneRate}%</p>
              <p className="text-xs text-muted-foreground">Com telefone</p>
            </div>
            
            <div className="p-4 bg-muted rounded-lg border border-border text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg className="h-4 w-4 text-success" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <p className="text-2xl font-bold text-success">{whatsappRate}%</p>
              <p className="text-xs text-muted-foreground">Com WhatsApp</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Limites */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            Limites e Informações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Leads por busca (Scraping)</span>
              <span className="text-sm font-medium text-foreground">até 200</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Leads por busca (Places API)</span>
              <span className="text-sm font-medium text-foreground">até 60</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Tempo médio (Scraping)</span>
              <span className="text-sm font-medium text-foreground">1-3 minutos</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Tempo médio (Places API)</span>
              <span className="text-sm font-medium text-foreground">1-5 segundos</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Custo por busca (Browserless)</span>
              <span className="text-sm font-medium text-foreground">~2-3 unidades{useResidentialProxy ? " (+5 proxy)" : ""}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Custo por busca (Places API)</span>
              <span className="text-sm font-medium text-foreground">~$0.035-0.105</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </ServiceConfigSection>
  );
}
