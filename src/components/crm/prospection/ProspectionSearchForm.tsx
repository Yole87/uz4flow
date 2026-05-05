import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getImpersonatedOrgId } from "@/hooks/useImpersonation";
import { useBrowserlessConfig } from "@/hooks/useBrowserlessConfig";
import { useGooglePlacesConfig } from "@/hooks/useGooglePlacesConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  MapPin,
  Loader2,
  MessageCircle,
  Map,
  Sparkles,
  AlertTriangle,
  Settings,
  Cloud,
  Zap,
  Info,
  HelpCircle,
} from "lucide-react";

interface ProspectionSearchFormProps {
  onSearchStarted: (searchId: string, options?: {functionName?: string;autoStep?: boolean; meta?: { keyword?: string; location?: string; provider?: string }}) => void;
  onPlacesApiComplete?: (result: unknown) => void;
  isSearching: boolean;
  setIsSearching: (value: boolean) => void;
  onGoToConfig?: () => void;
  hasUnsavedLeads?: boolean;
  unsavedCount?: number;
}

export function ProspectionSearchForm({
  onSearchStarted,
  isSearching,
  setIsSearching,
  onGoToConfig,
  hasUnsavedLeads = false,
  unsavedCount = 0,
}: ProspectionSearchFormProps) {
  const { toast } = useToast();
  const { isConfigured: isBrowserlessConfigured, isLoading: isLoadingBrowserless } = useBrowserlessConfig();
  const { isConfigured: isPlacesConfigured, preferredProvider, isLoading: isLoadingPlaces } = useGooglePlacesConfig();

  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState([100]);
  const [whatsappOnly, setWhatsappOnly] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const isUsingPlacesApi = preferredProvider === "places_api" && isPlacesConfigured;
  const isConfigured = isUsingPlacesApi ? isPlacesConfigured : isBrowserlessConfigured;
  const maxResultsLimit = 1000;
  const needsLocationForHighVolume = isUsingPlacesApi && maxResults[0] > 60 && !location.trim();

  const scrapingMutation = useMutation({
    mutationFn: async () => {
      const impersonatedOrgId = getImpersonatedOrgId();
      const { data, error } = await supabase.functions.invoke("gmaps-visual-scraper", {
        body: {
          action: "start",
          keyword,
          location: location || undefined,
          maxResults: maxResults[0],
          ...(impersonatedOrgId && { impersonate_org_id: impersonatedOrgId }),
        }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      onSearchStarted(data.session_id, { functionName: "gmaps-visual-scraper", autoStep: false, meta: { keyword, location, provider: "scraping" } });
      toast({
        title: "Extração iniciada!",
        description: "Acompanhe o progresso em tempo real"
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao iniciar busca",
        description: error.message,
        variant: "destructive"
      });
      setIsSearching(false);
    }
  });

  const placesApiMutation = useMutation({
    mutationFn: async () => {
      const impersonatedOrgId = getImpersonatedOrgId();
      const { data, error } = await supabase.functions.invoke("google-places-search", {
        body: {
          action: "start",
          keyword,
          location: location || undefined,
          maxResults: maxResults[0],
          ...(impersonatedOrgId && { impersonate_org_id: impersonatedOrgId }),
        }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      onSearchStarted(data.session_id, { functionName: "google-places-search", autoStep: true, meta: { keyword, location, provider: "places_api" } });
      toast({
        title: "Busca iniciada!",
        description: "Coletando leads via Google Places API..."
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao buscar",
        description: error.message,
        variant: "destructive"
      });
      setIsSearching(false);
    }
  });

  const runSearch = () => {
    setIsSearching(true);
    if (isUsingPlacesApi) {
      placesApiMutation.mutate();
    } else {
      scrapingMutation.mutate();
    }
  };

  const handleSearch = () => {
    if (!keyword.trim()) {
      toast({ title: "Digite uma palavra-chave", variant: "destructive" });
      return;
    }

    if (needsLocationForHighVolume) {
      toast({
        title: "Localização obrigatória",
        description: "Para buscar mais de 60 leads via Places API, informe uma localização.",
        variant: "destructive"
      });
      return;
    }

    if (hasUnsavedLeads) {
      setDiscardConfirmOpen(true);
      return;
    }

    runSearch();
  };

  const estimatedRequests = isUsingPlacesApi ?
  Math.ceil(maxResults[0] / 20) * (maxResults[0] > 60 ? 1.5 : 1) :
  0;
  const estimatedCost = estimatedRequests * 0.035;

  if (isLoadingBrowserless || isLoadingPlaces) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>);

  }

  if (!isConfigured) {
    return (
      <Card className="border-warning/50">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Configuração Pendente
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Configure uma chave de API para iniciar buscas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-medium">Nenhum método de busca configurado</p>
                <p className="text-xs text-warning/80">
                  Você pode configurar uma das opções abaixo na aba "Configurações":
                </p>
                <ul className="text-xs text-warning/80 space-y-1">
                  <li>• <strong>Browserless (Gratuito)</strong>: Scraping do Google Maps - 1.000 unidades grátis/mês</li>
                  <li>• <strong>Google Places API (Pago)</strong>: API oficial - custo pelo Google Cloud</li>
                </ul>
              </div>
            </div>
          </div>

          {onGoToConfig &&
          <Button
            onClick={onGoToConfig}
            className="w-full bg-warning hover:bg-warning/90 text-warning-foreground">

              <Settings className="h-4 w-4 mr-2" />
              Ir para Configurações
            </Button>
          }
        </CardContent>
      </Card>);

  }

  return (
    <>
    <Card className="border-accent/20 hover:shadow-[0_0_25px_hsl(var(--accent)/0.15)]">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Search className="h-5 w-5 text-accent" />
          Buscar Leads
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {isUsingPlacesApi ?
          "Busca via Google Places API (até 1.000 leads)" :
          "Extração direta do Google Maps com IA"}
        </CardDescription>
        <Badge
          variant="outline"
          className={isUsingPlacesApi ?
          "w-fit bg-secondary/10 text-secondary border-secondary/30" :
          "w-fit bg-accent/10 text-accent border-accent/30"
          }>

          {isUsingPlacesApi ?
          <>
              <Cloud className="h-3 w-3 mr-1" />
              Places API (Pago)
            </> :

          <>
              <Map className="h-3 w-3 mr-1" />
              G-Maps Scraping
            </>
          }
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info box */}
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-accent">
          <div className="flex items-start gap-2">
            {isUsingPlacesApi ?
            <Zap className="h-4 w-4 mt-0.5 flex-shrink-0" /> :

            <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" />
            }
            <div>
              <p className="font-medium text-sm">
                {isUsingPlacesApi ? "Busca inteligente por regiões:" : "Extração inteligente:"}
              </p>
              <ul className="text-xs mt-1 space-y-1 opacity-80">
                {isUsingPlacesApi ?
                <>
                    <li>• Até 1.000 leads via varredura por sub-regiões</li>
                    <li>• Deduplicação automática de resultados</li>
                    <li>• 100% confiável, sem bloqueios</li>
                  </> :

                <>
                    <li>• Acessa o Google Maps automaticamente</li>
                    <li>• Extrai nome, telefone e website de cada negócio</li>
                    <li>• Enriquece com dados adicionais dos sites</li>
                  </>
                }
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="keyword" className="text-muted-foreground">
            Palavra-chave *
          </Label>
          <Input
            id="keyword"
            placeholder="Ex: Pizzarias, Academias, Dentistas"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="bg-muted border-border text-foreground"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            disabled={isSearching} />

        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="text-muted-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Localização
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex items-center justify-center rounded-full hover:bg-muted transition-colors" tabIndex={-1}>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  <p className="font-medium mb-1">Formatos aceitos:</p>
                  <ul className="space-y-0.5">
                    <li>• País (ex: Brasil)</li>
                    <li>• Estado (ex: São Paulo)</li>
                    <li>• Cidade (ex: Curitiba, PR)</li>
                    <li>• Bairro (ex: Moema, São Paulo)</li>
                    <li>• CEP (ex: 01310-100)</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {isUsingPlacesApi && maxResults[0] > 60 &&
            <span className="text-warning text-xs">(obrigatória para +60 leads)</span>
            }
          </Label>
          <Input
            id="location"
            placeholder="Ex: São Paulo, SP"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={`bg-muted border-border text-foreground ${
            needsLocationForHighVolume ? "border-warning" : ""}`
            }
            disabled={isSearching} />

          {needsLocationForHighVolume &&
          <p className="text-xs text-warning flex items-center gap-1">
              <Info className="h-3 w-3" />
              Informe a localização para buscar mais de 60 leads via Places API
            </p>
          }
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground">
              Máximo de resultados
              {maxResults[0] > 500 &&
              <span className="text-warning text-xs ml-2">(alto volume)</span>
              }
            </Label>
            <Input
              type="number"
              min={20}
              max={maxResultsLimit}
              value={maxResults[0]}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setMaxResults([val]);
              }}
              onBlur={(e) => {
                let val = parseInt(e.target.value, 10);
                if (isNaN(val) || val < 20) val = 20;
                if (val > maxResultsLimit) val = maxResultsLimit;
                setMaxResults([val]);
              }}
              disabled={isSearching}
              className="w-20 h-8 text-center text-sm !font-mono"
            />
          </div>
          <Slider
            value={maxResults}
            onValueChange={setMaxResults}
            min={20}
            max={maxResultsLimit}
            step={isUsingPlacesApi ? 20 : 50}
            disabled={isSearching}
            className="py-2 prospection-slider" />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>20</span>
            <span>
              {isUsingPlacesApi ?
              `~${Math.ceil(estimatedRequests)} requisições` :
              `~${Math.ceil(maxResults[0] / 50)} min`}
            </span>
            <span>{maxResultsLimit}</span>
          </div>
        </div>

        {!isUsingPlacesApi &&
        <div className="flex items-center space-x-2 pt-2">
            <Checkbox
            id="whatsapp-only"
            checked={whatsappOnly}
            onCheckedChange={(checked) => setWhatsappOnly(checked === true)}
            disabled={isSearching} />

            <Label
            htmlFor="whatsapp-only"
            className="text-muted-foreground flex items-center gap-2 cursor-pointer">

              <MessageCircle className="h-4 w-4 text-success" />
              Priorizar números de WhatsApp
            </Label>
          </div>
        }

        {isUsingPlacesApi &&
        <div className="p-2 bg-secondary/5 rounded-lg border border-secondary/20 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3 text-secondary" />
              A busca divide a região em sub-áreas para coletar mais resultados únicos.
            </p>
            {!location.trim() && maxResults[0] <= 60 &&
          <p className="text-xs text-muted-foreground">
                💡 Adicione uma localização para ativar a varredura por regiões (até 1.000 leads).
              </p>
          }
          </div>
        }

        <Button
          onClick={handleSearch}
          disabled={isSearching || !keyword.trim() || needsLocationForHighVolume}
          className="w-full gradient-primary hover:opacity-90 text-primary-foreground">

          {isSearching ?
          <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isUsingPlacesApi ? "Buscando..." : "Extraindo leads..."}
            </> :

          <>
              <Search className="h-4 w-4 mr-2" />
              Buscar Leads
            </>
          }
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {isUsingPlacesApi ?
          `💰 Custo estimado: ~$${estimatedCost.toFixed(2)} (${Math.ceil(estimatedRequests)} requisições)` :
          `⏱️ Tempo estimado: ~${Math.ceil(maxResults[0] / 50)} minutos para ${maxResults[0]} leads`
          }
        </p>
        {maxResults[0] > 500 &&
        <p className="text-xs text-warning text-center">
            ⚠️ Buscas com mais de 500 leads podem levar mais tempo. Mantenha a aba aberta.
          </p>
        }
      </CardContent>
    </Card>

    <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Descartar leads não salvos?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Você tem <strong className="text-foreground">{unsavedCount} {unsavedCount === 1 ? "lead" : "leads"}</strong> da última busca que ainda não {unsavedCount === 1 ? "foi salvo" : "foram salvos"} no CRM.
            Iniciar uma nova busca irá descartá-los permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar e salvar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setDiscardConfirmOpen(false);
              runSearch();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Descartar e buscar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}