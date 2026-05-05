import { useGooglePlacesConfig } from "@/hooks/useGooglePlacesConfig";
import { useBrowserlessConfig } from "@/hooks/useBrowserlessConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Check, 
  Loader2,
  Cloud,
  Map,
  Zap,
  Clock,
  Shield,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ProviderMethodSelector() {
  const {
    isConfigured: isPlacesConfigured,
    preferredProvider,
    setPreferredProvider,
    isSettingProvider,
  } = useGooglePlacesConfig();

  const {
    isConfigured: isBrowserlessConfigured,
  } = useBrowserlessConfig();

  const handleSelectProvider = (provider: "scraping" | "places_api") => {
    if (provider === preferredProvider) return;
    setPreferredProvider(provider);
  };

  const canSelectScraping = isBrowserlessConfigured;
  const canSelectPlacesApi = isPlacesConfigured;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          Método de Busca Ativo
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Escolha qual método usar para suas buscas de prospecção
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Scraping Option */}
          <button
            onClick={() => handleSelectProvider("scraping")}
            disabled={!canSelectScraping || isSettingProvider}
            className={cn(
              "relative p-4 rounded-lg border-2 text-left transition-all",
              preferredProvider === "scraping"
                ? "border-accent bg-accent/10"
                : "border-border bg-muted hover:border-muted-foreground/30",
              !canSelectScraping && "opacity-50 cursor-not-allowed"
            )}
          >
            {preferredProvider === "scraping" && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-accent/20 text-accent border-accent/30">
                  <Check className="h-3 w-3 mr-1" /> Ativo
                </Badge>
              </div>
            )}
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Map className="h-5 w-5 text-accent" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">Google Maps Scraping</h4>
                  <Badge className="bg-accent/20 text-accent border-accent/30 text-xs">
                    Gratuito*
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Navegação automatizada no Google Maps via Browserless
                </p>
                
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" /> ~20 min
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Check className="h-3 w-3 text-success" /> WhatsApp
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    Até 1.000 leads
                  </span>
                </div>

                {!canSelectScraping && (
                  <div className="flex items-center gap-1 text-warning text-xs mt-2">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Configure a chave Browserless acima</span>
                  </div>
                )}
              </div>
            </div>
          </button>

          {/* Places API Option */}
          <button
            onClick={() => handleSelectProvider("places_api")}
            disabled={!canSelectPlacesApi || isSettingProvider}
            className={cn(
              "relative p-4 rounded-lg border-2 text-left transition-all",
              preferredProvider === "places_api"
                ? "border-secondary bg-secondary/10"
                : "border-border bg-muted hover:border-muted-foreground/30",
              !canSelectPlacesApi && "opacity-50 cursor-not-allowed"
            )}
          >
            {preferredProvider === "places_api" && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-secondary/20 text-secondary border-secondary/30">
                  <Check className="h-3 w-3 mr-1" /> Ativo
                </Badge>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center flex-shrink-0">
                <Cloud className="h-5 w-5 text-secondary" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">Google Places API</h4>
                  <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs">
                    API Oficial
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  API oficial do Google - rápida e 100% confiável
                </p>
                
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Zap className="h-3 w-3 text-secondary" /> Segundos
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Shield className="h-3 w-3 text-success" /> Sem bloqueios
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    Até 1.000 leads
                  </span>
                </div>

                {!canSelectPlacesApi && (
                  <div className="flex items-center gap-1 text-warning text-xs mt-2">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Configure a chave Places API acima</span>
                  </div>
                )}
              </div>
            </div>
          </button>
        </div>

        {isSettingProvider && (
          <div className="flex items-center justify-center mt-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Atualizando...</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          * O método Scraping requer chave Browserless (1.000 unidades grátis/mês). O custo da API Oficial é cobrado diretamente pelo Google Cloud ($200/mês grátis).
        </p>
      </CardContent>
    </Card>
  );
}
