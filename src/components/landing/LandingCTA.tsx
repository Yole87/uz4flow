import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function LandingCTA() {
  return (
    <section className="py-14 md:py-20">
      <div className="container mx-auto px-4">
        <div
          className="relative quantum-glass-strong rounded-2xl p-10 md:p-16 text-center overflow-hidden"
          style={{
            borderImage: 'linear-gradient(135deg, hsl(180 100% 50% / 0.3), hsl(272 100% 50% / 0.3)) 1',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        >
          {/* Radial glow */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/15 rounded-full blur-3xl" />
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-scanline">
            Pronto para
            <span className="text-gradient-primary text-glow-pink"> escalar?</span>
          </h2>
          <p className="text-sm uppercase tracking-widest text-muted-foreground max-w-xl mx-auto mb-8 font-terminal">
            Comece gratuitamente e veja resultados no primeiro dia.
          </p>
          <Button size="lg" asChild className="gradient-primary border-0 text-lg px-8 py-6 neon-glow-pink btn-laser-cut">
            <Link to="/?tab=signup">
              Começar agora
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
