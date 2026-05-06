import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, MessageSquare, Mail, Instagram, Video, Hash } from "lucide-react";
import { toast } from "sonner";

interface Props {
  link: string;
  pct: number;
}

export function AffiliateCopyTemplates({ link, pct }: Props) {
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const whatsapp = `🚀 Conheci uma plataforma que tá mudando o jogo do atendimento via WhatsApp e Instagram: a *Uz4Flow*.

✅ CRM completo com IA
✅ Automação de mensagens e follow-up
✅ Funis de venda visuais (Kanban)
✅ Integração com Meta oficial

Tá com condição especial. Dá uma olhada com meu link de indicação:
👉 ${link}

Qualquer dúvida me chama!`;

  const instagram = `Pra quem trabalha com vendas no WhatsApp/Instagram e quer parar de perder lead — recomendo MUITO a @uz4flow.lovable.app 🔥

CRM + IA + automação tudo num lugar só.

Link na bio ou aqui ó 👇
${link}

#vendas #whatsappbusiness #automacao #crm`;

  const email = `Assunto: A ferramenta que mudou meu atendimento (e pode mudar o seu)

Olá!

Quero te apresentar uma plataforma que tem feito muita diferença pra quem vende pelo WhatsApp e Instagram: a Uz4Flow.

Em poucas palavras, ela junta CRM, automação de mensagens, IA e funis de venda — tudo num único painel. O resultado é: zero lead perdido, follow-up no automático, e equipe focada em fechar negócios.

Eu uso e indico. Se quiser testar com condição especial, segue meu link:
${link}

Qualquer dúvida, é só responder este e-mail.

Abraço!`;

  const videoScript = `🎬 ROTEIRO DE VÍDEO (30 segundos)

[0-3s] HOOK
"Você ainda perde lead no WhatsApp? Então presta atenção."

[3-12s] PROBLEMA
"Eu também perdia. Cliente mandava mensagem, ficava sem resposta, esquecia o follow-up… era um caos."

[12-22s] SOLUÇÃO
"Aí descobri a Uz4Flow: CRM, IA e automação tudo junto. Hoje todo lead é respondido, qualificado e movido no funil sem eu precisar lembrar."

[22-30s] CTA
"Tá com condição especial pra quem entra com meu link. Tá na descrição. Vai lá!"

📌 Dica: grave em vertical (9:16), boa iluminação e legenda na tela.`;

  const hashtags = [
    "#whatsappbusiness", "#vendasdigitais", "#automacao", "#crm",
    "#marketingdigital", "#empreendedorismo", "#vendasonline",
    "#chatbot", "#instagrambusiness", "#leadgeneration",
  ];

  const tips = [
    "Use seu próprio caso: conte como a Uz4Flow resolveu UM problema específico seu",
    "Stories funcionam muito bem — faça enquetes (ex: 'Quem aqui perde lead no WhatsApp?')",
    "Indique pra quem JÁ tem volume de mensagem (lojistas, infoprodutores, prestadores)",
    "Acompanhe pelo painel quem clicou e ainda não converteu — aqueça com mensagem direta",
    "Republique uma vez por semana com ângulos diferentes (problema, prova social, oferta)",
  ];

  return (
    <div className="space-y-4">
      {/* Copy templates */}
      <Card className="quantum-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Textos prontos pra divulgar
          </CardTitle>
          <p className="text-sm text-muted-foreground">Já vêm com seu link de indicação. Copie e cole onde quiser.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <CopyBlock icon={MessageSquare} title="WhatsApp" text={whatsapp} onCopy={() => copy(whatsapp, "Texto WhatsApp")} />
          <CopyBlock icon={Instagram} title="Instagram (legenda)" text={instagram} onCopy={() => copy(instagram, "Legenda Instagram")} />
          <CopyBlock icon={Mail} title="E-mail" text={email} onCopy={() => copy(email, "Texto e-mail")} />
        </CardContent>
      </Card>

      {/* Video script */}
      <Card className="quantum-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Roteiro de vídeo (30s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/50 border border-border p-4 whitespace-pre-line text-sm font-mono leading-relaxed">
            {videoScript}
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => copy(videoScript, "Roteiro")}>
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar roteiro
          </Button>
        </CardContent>
      </Card>

      {/* Hashtags & tips */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="quantum-glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="w-4 h-4 text-primary" />
              Hashtags recomendadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {hashtags.map((h) => (
                <Badge key={h} variant="outline" className="border-primary/30 text-primary/90 cursor-pointer hover:bg-primary/10" onClick={() => copy(h, h)}>
                  {h}
                </Badge>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => copy(hashtags.join(" "), "Hashtags")}>
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar todas
            </Button>
          </CardContent>
        </Card>

        <Card className="quantum-glass">
          <CardHeader>
            <CardTitle className="text-base">💡 Dicas que convertem</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {tips.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                  <span className="text-foreground/90">{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CopyBlock({ icon: Icon, title, text, onCopy }: { icon: any; title: string; text: string; onCopy: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onCopy} className="h-7">
          <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
        </Button>
      </div>
      <div className="p-3 text-sm whitespace-pre-line text-foreground/90 max-h-48 overflow-y-auto quantum-scrollbar">{text}</div>
    </div>
  );
}
