import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Settings, 
  Lightbulb,
  WifiOff,
  KeyRound,
  ServerCrash,
  CreditCard,
  PlugZap,
  ExternalLink,
  ShieldX
} from "lucide-react";
import { translateProspectionError } from "@/lib/errorMessages";
import { ReactNode } from "react";

interface ProspectionErrorCardProps {
  errorMessage: string | null | undefined;
  onRetry?: () => void;
  onGoToConfig?: () => void;
  leadsFound?: number;
}

function getErrorIcon(code: string): ReactNode {
  switch (code) {
    case "PROSP_001":
      return <Clock className="h-12 w-12 text-warning" />;
    case "PROSP_002":
      return <Clock className="h-12 w-12 text-warning" />;
    case "PROSP_003":
      return <KeyRound className="h-12 w-12 text-destructive" />;
    case "PROSP_004":
    case "PROSP_005":
      return <ServerCrash className="h-12 w-12 text-destructive" />;
    case "PROSP_009":
    case "PROSP_010":
      return <WifiOff className="h-12 w-12 text-warning" />;
    case "PROSP_008":
      return <Settings className="h-12 w-12 text-secondary" />;
    case "PROSP_011":
      return <CreditCard className="h-12 w-12 text-destructive" />;
    case "PROSP_012":
      return <PlugZap className="h-12 w-12 text-warning" />;
    case "PROSP_013":
      return <ShieldX className="h-12 w-12 text-destructive" />;
    default:
      return <AlertTriangle className="h-12 w-12 text-destructive" />;
  }
}

export function ProspectionErrorCard({ 
  errorMessage, 
  onRetry, 
  onGoToConfig,
  leadsFound = 0 
}: ProspectionErrorCardProps) {
  const translated = translateProspectionError(errorMessage);
  
  return (
    <Card className="border-border h-full">
      <CardContent className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
        {getErrorIcon(translated.code)}
        
        <div className="text-center max-w-md space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {translated.title}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {translated.message}
          </p>
        </div>
        
        {translated.waitTime && (
          <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 border border-warning/20 rounded-lg">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-sm text-warning">
              Aguarde aproximadamente <strong>{translated.waitTime}</strong>
            </span>
          </div>
        )}
        
        {translated.tip && (
          <div className="mt-2 p-4 bg-muted/50 rounded-lg max-w-md border border-border/50">
            <p className="text-sm text-muted-foreground flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <span>{translated.tip}</span>
            </p>
          </div>
        )}
        
        {leadsFound > 0 && (
          <div className="mt-2 p-3 bg-success/10 border border-success/20 rounded-lg">
            <p className="text-sm text-success">
              ✓ {leadsFound} leads foram encontrados antes do erro
            </p>
          </div>
        )}
        
        <div className="flex flex-wrap gap-3 mt-4 justify-center">
          {translated.actionUrl && (
            <a
              href={translated.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              {translated.actionLabel || "Abrir Console"}
            </a>
          )}
          {translated.showRetry && onRetry && (
            <Button 
              onClick={onRetry} 
              variant={translated.actionUrl ? "outline" : "default"}
              className={translated.actionUrl 
                ? "border-border text-foreground hover:bg-muted" 
                : "gradient-primary hover:opacity-90 text-primary-foreground"
              }
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          )}
          {translated.showConfig && onGoToConfig && (
            <Button 
              variant="outline" 
              onClick={onGoToConfig}
              className="border-border text-foreground hover:bg-muted"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
          )}
          {!translated.showRetry && !translated.showConfig && !translated.actionUrl && onRetry && (
            <Button 
              variant="outline" 
              onClick={onRetry}
              className="border-border text-foreground hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Nova Busca
            </Button>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground mt-4">
          Código do erro: {translated.code}
        </p>
      </CardContent>
    </Card>
  );
}
