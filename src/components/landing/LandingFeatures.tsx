import { 
  Zap, 
  Plug, 
  Route, 
  BarChart, 
  MessageSquare, 
  Clock,
  Shield,
  Users,
  LucideIcon
} from "lucide-react";

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface LandingFeaturesProps {
  features: Feature[];
}

const iconMap: Record<string, LucideIcon> = {
  Zap,
  Plug,
  Route,
  BarChart,
  MessageSquare,
  Clock,
  Shield,
  Users,
};

const neonHoverColors = [
  "hover:neon-glow-pink",
  "hover:neon-glow-cyan",
  "hover:neon-glow-purple",
  "hover:neon-glow-pink",
  "hover:neon-glow-cyan",
  "hover:neon-glow-purple",
  "hover:neon-glow-pink",
  "hover:neon-glow-cyan",
];

const defaultFeatures: Feature[] = [
  {
    icon: "Zap",
    title: "Fluxos Automatizados",
    description: "Crie sequências de mensagens personalizadas para cada tipo de cliente."
  },
  {
    icon: "Plug",
    title: "Conectores Universais",
    description: "Integre com qualquer sistema via webhooks e APIs."
  },
  {
    icon: "Route",
    title: "Regras Inteligentes",
    description: "Direcione mensagens automaticamente baseado em palavras-chave."
  },
  {
    icon: "BarChart",
    title: "Analytics Completo",
    description: "Acompanhe métricas e performance em tempo real."
  },
  {
    icon: "MessageSquare",
    title: "Templates Dinâmicos",
    description: "Use variáveis para personalizar cada mensagem automaticamente."
  },
  {
    icon: "Clock",
    title: "Reengajamento Automático",
    description: "Recupere conversas perdidas com mensagens programadas."
  },
  {
    icon: "Shield",
    title: "Segurança Total",
    description: "Seus dados protegidos com criptografia de ponta a ponta."
  },
  {
    icon: "Users",
    title: "Multi-usuários",
    description: "Gerencie sua equipe com diferentes níveis de acesso."
  }
];

export function LandingFeatures({ features }: LandingFeaturesProps) {
  const displayFeatures = features.length > 0 ? features : defaultFeatures;

  return (
    <section id="features" className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-scanline">
            Tudo que você precisa para
            <span className="text-gradient-primary text-glow-pink"> automatizar</span>
          </h2>
          <p className="text-sm uppercase tracking-widest text-muted-foreground max-w-2xl mx-auto font-terminal">
            Recursos poderosos para transformar seu atendimento no WhatsApp em uma máquina de vendas.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayFeatures.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Zap;
            return (
              <div 
                key={index}
                className={`group relative quantum-glass rounded-lg p-6 ${neonHoverColors[index % neonHoverColors.length]} transition-all duration-300`}
                style={{
                  borderImage: 'linear-gradient(135deg, hsl(180 100% 50% / 0.1), hsl(272 100% 50% / 0.1)) 1',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
              >
                {/* Terminal index */}
                <span className="font-terminal text-xs text-muted-foreground/50">
                  {String(index + 1).padStart(2, '0')} //
                </span>

                {/* Icon */}
                <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4 mt-2 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="font-terminal text-xs text-muted-foreground">
                  {feature.description}
                </p>

                {/* Hover gradient */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
