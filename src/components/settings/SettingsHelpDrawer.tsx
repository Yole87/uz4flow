import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ListOrdered, PlayCircle, Lightbulb } from "lucide-react";

export type HelpKey = "whatsapp" | "voice" | "ai" | "quick-replies" | "subscription" | "storage";

interface HelpContent {
  title: string;
  description: string;
  videoId?: string;
  steps?: string[];
  tips: string[];
}

const HELP: Record<HelpKey, HelpContent> = {
  whatsapp: {
    title: "Ajuda — WhatsApp",
    description: "Como conectar instâncias do Sistema de WhatsApp AI.",
    videoId: "HTyPIqa-vPQ",
    steps: [
      "Acesse seu Sistema de WhatsApp AI.",
      'Na página inicial, ative a opção "Fluxo".',
      'No menu lateral esquerdo, acesse a seção "Fluxo".',
      'Clique em "Gerar Token" (ou em "Copiar", caso já possua um token). Cole o valor no campo "Token".',
      'Logo abaixo do token, copie a URL da API e cole no campo "URL da API".',
      'Clique em "Salvar Configurações" no Sistema de WhatsApp AI e, em seguida, em "Cadastrar Instância" aqui.',
    ],
    tips: [
      'Use nomes claros (ex: "Vendas SP", "Suporte").',
      "A API Oficial da Meta exige Business Manager aprovado.",
      "Contas do Instagram são gerenciadas em Instagram → Contas, não aqui.",
    ],
  },
  voice: {
    title: "Ajuda — Voice AI (Vapi)",
    description: "Configure ligações com IA usando o Vapi.",
    videoId: "_8ZH1-o8mNM",
    steps: [
      "Crie uma conta gratuita em vapi.ai.",
      'No dashboard do Vapi, vá em "Settings" → "API Keys" e copie sua Private API Key.',
      'Em "Phone Numbers" no Vapi, importe um número do Twilio.',
      "Após importar, copie o Phone Number ID exibido na lista.",
      'Em "Voices", escolha uma voz e copie o Voice ID.',
    ],
    tips: [
      "Você precisa de créditos no Vapi para realizar chamadas.",
      "Teste com seu próprio número antes de campanhas em massa.",
    ],
  },
  ai: {
    title: "Ajuda — Inteligência Artificial",
    description: "Escolha o modelo que melhor se adapta ao seu fluxo de trabalho.",
    tips: [
      "Use Gemini 2.5 Flash para baixo custo e rapidez.",
      "Use GPT-5 quando precisar de raciocínio mais elaborado.",
      "Personalize o prompt para refletir o tom da sua marca.",
      "A IA atua nas sugestões automáticas e nas avaliações de conversa.",
    ],
  },
  "quick-replies": {
    title: "Ajuda — Respostas Rápidas",
    description: "Crie respostas reutilizáveis para acelerar o atendimento.",
    tips: [
      'No chat, digite "/" para abrir o seletor de respostas.',
      "Crie respostas por instância ou para todas ao mesmo tempo.",
      "Limites por tipo: 30 textos, 15 imagens, 5 áudios/vídeos/docs.",
      "Mídia até 16MB por arquivo.",
    ],
  },
  subscription: {
    title: "Ajuda — Assinatura",
    description: "Gerencie seu plano, ciclo de cobrança e funcionalidades.",
    tips: [
      "Você pode alterar seu plano a qualquer momento.",
      "O downgrade entra em vigor no próximo ciclo.",
      "Cancelamentos mantêm o acesso até o fim do período pago.",
    ],
  },
  storage: {
    title: "Ajuda — Armazenamento",
    description: "Acompanhe e gerencie o uso de espaço da sua organização.",
    tips: [
      "Mídias antigas podem ser removidas no próprio CRM (mensagens).",
      "Anexos de contatos contam para o limite total.",
      "Faça upgrade de plano para aumentar o limite de armazenamento.",
    ],
  },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  helpKey: HelpKey | null;
}

export function SettingsHelpDrawer({ open, onOpenChange, helpKey }: Props) {
  const content = helpKey ? HELP[helpKey] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto quantum-scrollbar">
        {content && (
          <>
            <SheetHeader>
              <SheetTitle>{content.title}</SheetTitle>
              <SheetDescription>{content.description}</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {content.videoId && (
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
                    <PlayCircle className="h-4 w-4 text-accent" />
                    Vídeo Tutorial
                  </h4>
                  <div className="aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${content.videoId}`}
                      title={content.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                </div>
              )}

              {content.steps && content.steps.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
                    <ListOrdered className="h-4 w-4 text-accent" />
                    Passo a Passo
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground">
                    {content.steps.map((step, i) => (
                      <li key={i} className="leading-relaxed">{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              <div>
                <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Lightbulb className="h-4 w-4 text-accent" />
                  Dicas Rápidas
                </h4>
                <div className="text-xs text-muted-foreground space-y-2">
                  {content.tips.map((t, i) => (
                    <p key={i} className="leading-relaxed">• {t}</p>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
