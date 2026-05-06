import { Workflow, Phone, Layers } from "lucide-react";

const differentials = [
  {
    icon: Workflow,
    title: "Editor visual de fluxos",
    description: "Monte automações com IA, voz e mensagens arrastando blocos. Sem código, sem limite.",
    glow: "hover:neon-glow-pink",
    iconColor: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Phone,
    title: "Voice AI integrada",
    description: "Ligações automatizadas com IA conectadas direto ao seu funil. Fale com leads em escala.",
    glow: "hover:neon-glow-cyan",
    iconColor: "text-secondary",
    bg: "bg-secondary/10",
  },
  {
    icon: Layers,
    title: "Multi-canal unificado",
    description: "WhatsApp e Instagram no mesmo CRM. Uma conversa, uma história, um funil.",
    glow: "hover:neon-glow-pink",
    iconColor: "text-accent-foreground",
    bg: "bg-accent/10",
  },
];

export function LandingTestimonials() {
  return (
    <section id="differentials" className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-scanline">
            Por que
            <span className="text-gradient-primary text-glow-pink"> Uz4Flow</span>
          </h2>
          <p className="text-sm uppercase tracking-widest text-muted-foreground max-w-2xl mx-auto font-terminal">
            Diferenciais técnicos que entregam resultado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {differentials.map((d, i) => (
            <div
              key={i}
              className={`group quantum-glass rounded-xl p-6 ${d.glow} transition-all duration-300 border border-border/20`}
            >
              <div className={`w-12 h-12 rounded-lg ${d.bg} flex items-center justify-center mb-4`}>
                <d.icon className={`w-6 h-6 ${d.iconColor}`} />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{d.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed font-terminal">
                {d.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
