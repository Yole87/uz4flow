import { Plug, Settings, TrendingUp } from "lucide-react";

const steps = [
  {
    icon: Plug,
    number: "01",
    title: "Conecte seu\nWhatsApp",
    description: "Vincule sua instância em segundos — sem código, sem complicação.",
  },
  {
    icon: Settings,
    number: "02",
    title: "Configure suas automações",
    description: "Crie fluxos, regras e conectores com nosso editor visual intuitivo.",
  },
  {
    icon: TrendingUp,
    number: "03",
    title: "Escale seu atendimento",
    description: "Acompanhe métricas, otimize processos e cresça com inteligência.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-scanline">
            Como
            <span className="text-gradient-primary text-glow-pink"> funciona</span>
          </h2>
          <p className="text-sm uppercase tracking-widest text-muted-foreground max-w-2xl mx-auto font-terminal">
            Três passos simples para transformar seu atendimento.
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Connecting line */}
          <div
            className="hidden md:block absolute top-24 left-[16%] right-[16%] h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, hsl(180 100% 50% / 0.4), hsl(272 100% 50% / 0.4), transparent)',
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center group">
                {/* Numbered circle */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform neon-glow-pink">
                    <step.icon className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <span className="absolute -top-2 -right-2 font-terminal text-xs text-primary bg-background rounded-full w-7 h-7 flex items-center justify-center border border-primary/30">
                    {step.number}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-foreground mb-2 whitespace-pre-line">{step.title}</h3>
                <p className="font-terminal text-xs text-muted-foreground max-w-[280px]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
