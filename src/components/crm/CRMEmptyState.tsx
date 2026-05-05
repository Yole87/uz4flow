import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare, Smartphone, Wifi, Settings, BookOpen, ArrowRight } from "lucide-react";

export function CRMEmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-0 flex-1 bg-background text-center px-6">
      <div className="relative mb-6">
        <div className="bg-muted rounded-full p-8">
          <Smartphone className="h-16 w-16 text-emerald-500" />
        </div>
        <div className="absolute -bottom-1 -right-1 bg-emerald-600 rounded-full p-2">
          <Wifi className="h-5 w-5 text-white" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-foreground mb-2">
        Conecte seu WhatsApp
      </h2>

      <p className="text-muted-foreground max-w-md mb-6">
        Para começar a usar o CRM, configure sua instância em Configurações
        para receber e enviar mensagens via webhook.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          onClick={() => navigate("/settings")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Settings className="h-4 w-4 mr-2" />
          Ir para Configurações
        </Button>

        <Button
          variant="outline"
          className="border-border text-muted-foreground hover:bg-muted"
          onClick={() => navigate("/tutorials")}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Ver Tutoriais
        </Button>
      </div>

      {/* Quick steps */}
      <div className="mt-8 w-full max-w-sm space-y-3 text-left">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">Como começar</p>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">1</span>
          <div>
            <p className="text-sm font-medium text-foreground">Configure sua instância</p>
            <p className="text-xs text-muted-foreground">Adicione URL e token do Sistema de WhatsApp AI em Configurações</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">2</span>
          <div>
            <p className="text-sm font-medium text-foreground">Crie fluxos de automação</p>
            <p className="text-xs text-muted-foreground">Monte respostas automáticas para seus leads</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">3</span>
          <div>
            <p className="text-sm font-medium text-foreground">Comece a atender</p>
            <p className="text-xs text-muted-foreground">Mensagens chegam aqui automaticamente</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          Webhook do WhatsApp AI
        </div>
      </div>
    </div>
  );
}
