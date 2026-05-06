import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListOrdered, PlayCircle, Lightbulb } from "lucide-react";

const registrationSteps = [
  "Acesse seu Sistema de WhatsApp AI.",
  'Na página inicial, ative a opção "Fluxo".',
  'No menu lateral esquerdo, acesse a seção "Fluxo".',
  'Clique em "Gerar Token" (ou em "Copiar", caso já possua um token). Cole o valor no campo "Token" do Uz4Flow.',
  'Logo abaixo do token, copie a URL da API e cole no campo "URL da API" do Uz4Flow.',
  'Clique em "Salvar Configurações" no Sistema de WhatsApp AI e, em seguida, em "Cadastrar Instância" no Uz4Flow.',
];

const TUTORIAL_VIDEO_ID = "HTyPIqa-vPQ";

export function IntegrationHelpAside() {
  return (
    <div className="space-y-4">
      <Card className="quantum-glass border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <PlayCircle className="h-4 w-4 text-accent" />
            Vídeo Tutorial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-video rounded-lg overflow-hidden border border-border bg-muted">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${TUTORIAL_VIDEO_ID}`}
              title="Tutorial de configuração"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="quantum-glass border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListOrdered className="h-4 w-4 text-accent" />
            Passo a Passo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground">
            {registrationSteps.map((step, i) => (
              <li key={i} className="leading-relaxed">{step}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="quantum-glass border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-accent" />
            Dicas Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>• Use nomes claros para suas instâncias (ex: "Vendas SP", "Suporte").</p>
          <p>• A API Oficial Meta exige Business Manager aprovado.</p>
          <p>• Contas do Instagram são gerenciadas em <strong>Instagram → Contas</strong>, não aqui.</p>
        </CardContent>
      </Card>
    </div>
  );
}
