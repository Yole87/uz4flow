import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { HelpCircle, Mail } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface LandingFAQProps {
  items: FAQItem[];
  supportEmail?: string;
}

const defaultFAQ: FAQItem[] = [
  {
    question: "Como funciona o período de teste?",
    answer: "São 7 dias com TODOS os recursos liberados — sem precisar cadastrar cartão de crédito. Você experimenta a plataforma completa e decide com calma qual plano faz sentido pro seu negócio."
  },
  {
    question: "Posso mudar de plano a qualquer momento?",
    answer: "Sim. Upgrades são aplicados imediatamente, com cobrança proporcional. Downgrades entram em vigor no próximo ciclo de cobrança, mantendo seu acesso atual até lá."
  },
  {
    question: "Como funciona o suporte?",
    answer: "Suporte via chat dentro da plataforma para os planos CRM e Completo. O plano Completo conta com atendimento prioritário (resposta em até 2h em horário comercial). Base de conhecimento e tutoriais disponíveis em /docs para todos."
  },
  {
    question: "Preciso de conhecimento técnico para usar?",
    answer: "Não. O editor visual de fluxos é arrastar-e-soltar — sem código. Para quem quer ir além, oferecemos API REST documentada e webhooks para integrações personalizadas."
  },
  {
    question: "Meus dados estão seguros?",
    answer: "Sim. Conformidade com a LGPD, criptografia AES-256-GCM em repouso, TLS em trânsito e infraestrutura hospedada no Brasil (região São Paulo). Backup automático diário e isolamento por organização via Row-Level Security."
  },
  {
    question: "Posso cancelar a qualquer momento?",
    answer: "Sim, sem multa e sem burocracia. O cancelamento mantém seu acesso até o fim do período já pago e seus dados ficam disponíveis para exportação por 30 dias."
  },
  {
    question: "Qual a diferença entre conectar WhatsApp por QR Code ou API Oficial?",
    answer: "QR Code (Baileys): conexão rápida via celular, ideal pra começar e testar — usa seu WhatsApp pessoal ou comercial. API Oficial (Meta): número verificado pela Meta com templates aprovados, ideal pra escala e disparos em massa, com mais estabilidade e sem risco de bloqueio."
  },
  {
    question: "O Voice AI funciona em qual plano?",
    answer: "O Voice AI (ligações automatizadas com inteligência artificial) está disponível apenas no plano Completo, junto com Prospecção, Acesso API e MCP Gateway."
  }
];

export function LandingFAQ({ items, supportEmail = "suporte@openflow.studio" }: LandingFAQProps) {
  const displayItems = items.length > 0 ? items : defaultFAQ;

  return (
    <section id="faq" className="py-20 md:py-32 relative">
      {/* Background orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-scanline">
            Perguntas
            <span className="text-gradient-primary text-glow-pink"> Frequentes</span>
          </h2>
          <p className="text-sm uppercase tracking-widest text-muted-foreground max-w-2xl mx-auto font-terminal">
            Tire suas dúvidas sobre a plataforma. Se não encontrar o que procura, entre em contato.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {displayItems.map((item, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="quantum-glass rounded-lg px-6 data-[state=open]:neon-glow-pink transition-all"
              >
                <AccordionTrigger className="text-left font-medium hover:no-underline py-5 gap-3">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <span>{item.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 pl-8 font-terminal text-sm">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Contact CTA */}
          <div className="relative mt-12">
            {/* Neon orb behind CTA */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative text-center p-8 quantum-glass-strong rounded-lg neon-glow-pink">
              <HelpCircle className="w-12 h-12 text-primary mx-auto mb-4 text-glow-pink" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Ainda tem dúvidas?
              </h3>
              <p className="text-muted-foreground mb-6 font-terminal text-sm">
                Nossa equipe está pronta para ajudar você a tirar todas as suas dúvidas.
              </p>
              <Button asChild className="gradient-primary border-0 btn-laser-cut">
                <a href={`mailto:${supportEmail}`} className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Fale Conosco
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
