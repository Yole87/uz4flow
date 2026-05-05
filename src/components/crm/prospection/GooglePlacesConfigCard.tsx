import { useState } from "react";
import { useGooglePlacesConfig } from "@/hooks/useGooglePlacesConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Check, 
  Loader2,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  Trash2,
  Cloud,
  Zap,
  DollarSign,
  Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function GooglePlacesConfigCard() {
  const {
    isConfigured,
    maskedKey,
    lastTestAt,
    isLoading,
    saveKey,
    isSaving,
    testKey,
    isTesting,
    removeKey,
    isRemoving,
  } = useGooglePlacesConfig();

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSaveKey = () => {
    if (apiKeyInput.trim().length >= 10) {
      saveKey(apiKeyInput.trim());
      setApiKeyInput("");
      setShowInput(false);
    }
  };

  const handleRemoveKey = () => {
    if (confirm("Tem certeza que deseja remover a chave Google Places API?")) {
      removeKey();
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-secondary/30">
      <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2 flex-wrap">
              <Cloud className="h-5 w-5 text-secondary" />
              Google Places API
              <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs">
                API Oficial
              </Badge>
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Busca rápida e confiável via API oficial do Google
            </CardDescription>
          </div>
          {isConfigured ? (
            <Badge className="bg-success/20 text-success border-success/30 self-start sm:self-auto">
              <Check className="h-3 w-3 mr-1" /> Configurado
            </Badge>
          ) : (
            <Badge className="bg-muted text-muted-foreground border-border self-start sm:self-auto">
              Opcional
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Benefits */}
        <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-lg">
          <div className="flex items-start gap-2 text-secondary text-sm">
            <Zap className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Vantagens da API</p>
              <ul className="text-xs opacity-80 mt-1 space-y-0.5">
                <li>• Resultados em segundos (vs minutos)</li>
                <li>• Sem bloqueios ou CAPTCHAs</li>
                <li>• Horários de funcionamento inclusos</li>
                <li>• Google oferece $200/mês de crédito gratuito</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Cost clarification */}
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 p-2 bg-muted/50 rounded-lg">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span>O custo é cobrado diretamente pelo Google Cloud, não pelo nosso sistema.</span>
        </div>

        {/* Cost info */}
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Custo: ~$0.035/busca (~R$0.18) | Até 60 resultados por busca
          </span>
        </div>

        {!isConfigured ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-muted-foreground">API Key do Google Cloud</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder="AIzaSy..."
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
                  className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-secondary hover:text-secondary/80"
              >
                Obter chave no Google Cloud Console
                <ExternalLink className="h-3 w-3" />
              </a>
              <p>Ative a "Places API (New)" no seu projeto.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 bg-muted rounded-lg border border-border space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
                    <Key className="h-5 w-5 text-secondary" />
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
                      className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setShowInput(false); setApiKeyInput(""); }}
                      className="border-border"
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
  );
}
