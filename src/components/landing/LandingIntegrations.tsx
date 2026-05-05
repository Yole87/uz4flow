import { MessageSquare, MapPin, Webhook, Code, Phone, Network, Instagram, CalendarDays, Bot } from "lucide-react";

const integrations = [
  { icon: MessageSquare, name: "WhatsApp" },
  { icon: Instagram, name: "Instagram" },
  { icon: Bot, name: "Chatbot IA" },
  { icon: Phone, name: "Vapi (Voz IA)" },
  { icon: MapPin, name: "Google Places" },
  { icon: CalendarDays, name: "Google Calendar" },
  { icon: Webhook, name: "Webhooks" },
  { icon: Code, name: "API REST" },
  { icon: Network, name: "MCP Gateway", comingSoon: true },
];

export function LandingIntegrations() {
  return (
    <section id="integrations" className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-scanline">
            Integra com
            <span className="text-gradient-primary text-glow-pink"> tudo</span>
          </h2>
          <p className="text-sm uppercase tracking-widest text-muted-foreground max-w-2xl mx-auto font-terminal">
            Conecte-se aos serviços que você já usa — sem fricção.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-5 sm:gap-6 max-w-3xl mx-auto">
          {integrations.map((item, i) => (
            <div
              key={i}
              className="group relative quantum-glass rounded-lg px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3 hover:neon-glow-cyan transition-all duration-300 overflow-visible"
              style={{
                borderImage: 'linear-gradient(135deg, hsl(180 100% 50% / 0.1), hsl(272 100% 50% / 0.1)) 1',
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            >
              <item.icon className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="font-terminal text-xs uppercase tracking-widest text-foreground/80">
                {item.name}
              </span>
              {item.comingSoon && (
                <span className="absolute -top-2.5 -right-2.5 text-[8px] font-terminal uppercase tracking-wider bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full z-10 whitespace-nowrap">
                  Em breve
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
