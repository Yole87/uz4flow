import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, MessageSquare, Zap, GitBranch } from "lucide-react";

interface LandingHeroProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaSecondaryText: string;
}

export function LandingHero({ title, subtitle, ctaText, ctaSecondaryText }: LandingHeroProps) {
  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-glow-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-glow-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/15 rounded-full blur-3xl animate-glow-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto text-center">
          {/* Badge - laser-cut style */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 quantum-glass border border-primary/30 mb-8 animate-fade-in btn-laser-cut">
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
            <span className="text-xs sm:text-sm font-terminal uppercase tracking-wide sm:tracking-widest text-secondary-foreground">
              Automação inteligente para WhatsApp e Instagram
            </span>
          </div>

          {/* Title with scanline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-[1.05] tracking-tight animate-fade-in text-scanline text-balance">
            {(() => {
              const words = title.split(" ");
              const regularPart = words.slice(0, -2).join(" ");
              const highlightPart = words.slice(-2).join(" ");
              return (
                <>
                  {regularPart}{" "}
                  <span className="text-gradient-primary text-glow-pink whitespace-nowrap">{highlightPart}</span>
                </>
              );
            })()}
          </h1>

          {/* Subtitle - uppercase tracking */}
          <p className="text-sm md:text-base uppercase tracking-widest text-muted-foreground mb-10 max-w-3xl mx-auto animate-fade-in font-terminal">
            {subtitle}
          </p>

          {/* CTAs */}
          <div className="flex flex-col items-center justify-center gap-3 mb-16 animate-fade-in w-full sm:w-auto">
            <Button size="lg" asChild className="gradient-primary border-0 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 neon-glow-pink btn-laser-cut w-full sm:w-auto">
              <Link to="/auth?signup=true">
                {ctaText}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            {ctaSecondaryText ? (
              <div className="relative w-full sm:w-auto">
                <Button size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 btn-laser-cut w-full" onClick={() => {
                  const el = document.getElementById("showcase");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}>
                  <Play className="mr-2 w-5 h-5" />
                  {ctaSecondaryText}
                </Button>
              </div>
            ) : (
              <p className="text-xs font-terminal uppercase tracking-widest text-muted-foreground">
                Sem cartão de crédito · 7 dias grátis
              </p>
            )}
          </div>

          {/* Floating cards preview with holographic border */}
          <div className="relative max-w-3xl mx-auto">
            <div
              className="relative quantum-glass-strong rounded-lg shadow-2xl p-6 animate-fade-in"
              style={{
                borderImage: 'linear-gradient(135deg, hsl(180 100% 50% / 0.4), hsl(272 100% 50% / 0.4)) 1',
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            >
              {/* Mock dashboard */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-warning" />
                <div className="w-3 h-3 rounded-full bg-success" />
              </div>
              
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {/* Sidebar mock */}
                <div className="col-span-1 space-y-3">
                  {/* Search bar */}
                  <div className="h-8 bg-muted rounded-lg flex items-center gap-2 px-2 overflow-hidden">
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/20 shrink-0" />
                    <div className="h-2 w-full rounded bg-muted-foreground/10 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent animate-[shimmer_2s_infinite]" style={{ backgroundSize: '200% 100%' }} />
                    </div>
                  </div>
                  {/* Contact items */}
                  <div className="bg-muted rounded-lg p-2 space-y-2.5">
                    {[0, 0.3, 0.6].map((delay, i) => (
                      <div key={i} className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: `${delay}s` }}>
                        <div className="w-6 h-6 rounded-full bg-primary/20 shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-1.5 w-3/4 rounded bg-foreground/10" />
                          <div className="h-1.5 w-1/2 rounded bg-muted-foreground/10" />
                        </div>
                        <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-success' : 'bg-muted-foreground/20'}`} />
                      </div>
                    ))}
                  </div>
                  {/* Stats bars */}
                  <div className="bg-muted rounded-lg p-2 space-y-2">
                    {[70, 45, 85].map((w, i) => (
                      <div key={i} className="space-y-1">
                        <div className="h-1 w-1/3 rounded bg-muted-foreground/10" />
                        <div className="h-2 rounded-full bg-muted-foreground/10 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/30 animate-[grow_1.5s_ease-out_forwards]" style={{ width: `${w}%`, animationDelay: `${0.5 + i * 0.2}s` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Main area */}
                <div className="col-span-2 space-y-3">
                  {/* Header with status dots */}
                  <div className="h-8 bg-muted rounded-lg flex items-center justify-between px-3">
                    <div className="h-2 w-20 rounded bg-muted-foreground/10" />
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      <div className="w-2 h-2 rounded-full bg-warning" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
                    </div>
                  </div>
                  <div className="h-52 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl bg-primary/30 flex items-center justify-center animate-float">
                        <MessageSquare className="w-5 h-5 sm:w-8 sm:h-8 text-primary" />
                      </div>
                      <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6 text-muted-foreground" />
                      <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl bg-accent/30 flex items-center justify-center animate-float" style={{ animationDelay: "0.5s" }}>
                        <GitBranch className="w-5 h-5 sm:w-8 sm:h-8 text-accent" />
                      </div>
                      <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6 text-muted-foreground" />
                      <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl bg-success/30 flex items-center justify-center animate-float" style={{ animationDelay: "1s" }}>
                        <Zap className="w-5 h-5 sm:w-8 sm:h-8 text-success" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating elements */}
            <div className="absolute -top-4 left-0 sm:-left-4 quantum-glass rounded-lg shadow-lg p-2 sm:p-3 animate-float neon-glow-pink max-w-[160px] sm:max-w-none">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-success" />
                </div>
                <div>
                  <div className="text-xs font-medium">Mensagem enviada</div>
                  <div className="text-xs text-muted-foreground font-terminal">Agora mesmo</div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 right-2 sm:-right-4 quantum-glass rounded-lg shadow-lg p-2 sm:p-3 animate-float neon-glow-cyan max-w-[160px] sm:max-w-none" style={{ animationDelay: "1.5s" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-xs font-medium">Fluxo ativado</div>
                  <div className="text-xs text-muted-foreground font-terminal">+150 hoje</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
