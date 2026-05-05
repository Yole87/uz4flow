import { MessageSquare, Bot, Sparkles, Instagram, Phone, Check, Rocket } from "lucide-react";

const pillars = [
  {
    icon: MessageSquare,
    title: "CRM & Vendas",
    description: "Gerencie todo o ciclo de vendas.",
    items: [
      "CRM WhatsApp em tempo real",
      "Funil Kanban visual",
      "Campanhas de Follow-up",
      "Gestão avançada de contatos",
    ],
    glowClass: "neon-glow-pink",
    gradient: "from-primary/20 to-primary/5",
  },
  {
    icon: Bot,
    title: "Automação Inteligente",
    description: "Automatize processos e escale sem esforço.",
    items: [
      "Fluxos de mensagens automáticos",
      "Conectores e Webhooks universais",
      "Regras de roteamento inteligente",
      "Reengajamento automático de leads",
    ],
    glowClass: "neon-glow-cyan",
    gradient: "from-accent/20 to-accent/5",
  },
  {
    icon: Sparkles,
    title: "IA & Prospecção",
    description: "Inteligência artificial que trabalha por você.",
    items: [
      "Chatbot IA integrado (WhatsApp AI)",
      "Extrator de contatos automatizado",
      "Análise e sugestões por IA",
      "Assistente Lia integrada ao sistema",
    ],
    glowClass: "neon-glow-purple",
    gradient: "from-secondary/20 to-secondary/5",
  },
  {
    icon: Instagram,
    title: "Instagram Automation",
    description: "Automatize DMs, comentários e stories no Instagram.",
    items: [
      "Respostas automáticas em DMs",
      "Private Replies em comentários",
      "Fluxos de captura de leads",
      "Templates reutilizáveis",
    ],
    glowClass: "neon-glow-pink",
    gradient: "from-primary/20 to-primary/5",
  },
  {
    icon: Phone,
    title: "Voice AI & Campanhas",
    description: "Ligações automatizadas com inteligência artificial.",
    items: [
      "Ligações com IA (Vapi)",
      "Campanhas de voz em massa",
      "Scripts inteligentes com IA",
      "Relatórios de performance",
    ],
    glowClass: "neon-glow-cyan",
    gradient: "from-accent/20 to-accent/5",
  },
  {
    icon: Sparkles,
    title: "Evolução Contínua",
    description: "Novas funcionalidades sendo construídas constantemente.",
    items: [
      "Novas integrações em desenvolvimento",
      "Melhorias baseadas no seu feedback",
      "Roadmap aberto e transparente",
      "Atualizações frequentes",
    ],
    glowClass: "neon-glow-cyan",
    gradient: "from-muted/20 to-muted/5",
    isComingSoon: true,
  },
];
export function LandingShowcase() {
  return (
    <section id="showcase" className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-scanline">
            Tudo em uma
            <span className="text-gradient-primary text-glow-pink"> única plataforma</span>
          </h2>
          <p className="text-sm uppercase tracking-widest text-muted-foreground max-w-2xl mx-auto font-terminal">
            Do primeiro contato ao fechamento — CRM, automação e IA trabalhando juntos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((pillar, i) => (
            <div
              key={i}
              className={`group relative quantum-glass rounded-xl p-5 sm:p-6 md:p-8 transition-all duration-300 ${pillar.isComingSoon ? 'border border-dashed border-muted-foreground/30' : ''} ${pillar.glowClass === 'neon-glow-pink' ? 'hover:neon-glow-pink' : pillar.glowClass === 'neon-glow-cyan' ? 'hover:neon-glow-cyan' : 'hover:neon-glow-purple'}`}
              style={pillar.isComingSoon ? {} : {
                borderImage: 'linear-gradient(135deg, hsl(180 100% 50% / 0.1), hsl(272 100% 50% / 0.1)) 1',
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            >
              {pillar.isComingSoon && (
                <span className="absolute top-3 right-3 text-[9px] font-terminal uppercase tracking-wider bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                  Em construção
                </span>
              )}
              <div className={`w-14 h-14 rounded-xl ${pillar.isComingSoon ? 'bg-muted' : 'gradient-primary'} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                {pillar.isComingSoon ? <Rocket className="w-7 h-7 text-muted-foreground" /> : <pillar.icon className="w-7 h-7 text-primary-foreground" />}
              </div>

              <h3 className="text-xl font-bold text-foreground mb-3">{pillar.title}</h3>
              <p className="font-terminal text-xs text-muted-foreground mb-6">{pillar.description}</p>

              <ul className="space-y-3">
                {pillar.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${pillar.gradient} opacity-0 group-hover:opacity-100 transition-opacity -z-10`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
