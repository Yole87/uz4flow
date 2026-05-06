import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, CheckCircle2, ArrowRight, Clock, Wallet, BarChart3, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAffiliateSettings } from "@/hooks/useAffiliate";

interface Props {
  variant?: "full" | "compact";
  onCtaClick?: () => void;
}

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function AffiliateHero({ variant = "full", onCtaClick }: Props) {
  const navigate = useNavigate();
  const { data: settings } = useAffiliateSettings();

  const pct = Number(settings?.default_commission_percent ?? 20);
  const hours = Number(settings?.payout_processing_hours ?? 72);
  const payDay = Number(settings?.payout_day_of_month ?? 10);
  const minPayout = Number(settings?.min_payout ?? 50);
  const rate = pct / 100;

  if (variant === "compact") {
    return (
      <Card className="quantum-glass border-primary/30 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
        <CardContent className="p-5 relative">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center neon-glow-pink shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Ganhe <span className="text-primary">até {pct}% recorrente</span> em cada indicação paga
                </p>
                <p className="text-xs text-muted-foreground">Quanto mais clientes você levar, maior fica sua comissão.</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-primary/40 hover:bg-primary/10"
              onClick={onCtaClick}
            >
              Ver materiais <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="quantum-glass border-primary/30 overflow-hidden relative">
      {/* Decorative glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/10 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-accent/15 blur-3xl pointer-events-none" />

      <CardContent className="relative p-6 md:p-8">
        <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-xs font-bold text-primary uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Programa de afiliados Uz4Flow
            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
              Ganhe <span className="text-primary">até {pct}% de comissão recorrente</span><br />
              enquanto seu indicado for cliente.
            </h2>

            <p className="text-base text-muted-foreground max-w-2xl">
              Indique a Uz4Flow para sua rede e receba todo mês — sem teto, sem prazo de validade.
              <span className="text-foreground/85"> Quanto mais clientes você levar, maior fica sua comissão.</span>
            </p>

            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Pagamento via PIX</p>
                  <p className="text-xs text-muted-foreground">Em até {hours}h úteis</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Materiais prontos</p>
                  <p className="text-xs text-muted-foreground">Banners, vídeos e copy</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Painel completo</p>
                  <p className="text-xs text-muted-foreground">Acompanhe em tempo real</p>
                </div>
              </div>
            </div>

            {/* Quanto você ganha */}
            <div className="rounded-xl border border-primary/20 bg-background/40 backdrop-blur p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <TrendingUp className="w-4 h-4 text-primary" />
                <p className="text-sm font-bold text-foreground uppercase tracking-wider">Quanto você ganha</p>
                <span className="text-xs text-muted-foreground">· {pct}% por pagamento recebido</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">1 cliente CRM ({brl(147)})</p>
                  <p className="text-lg font-bold text-primary">{brl(147 * rate)}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">1 cliente Completo ({brl(347)})</p>
                  <p className="text-lg font-bold text-primary">{brl(347 * rate)}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">10 clientes mix (média {brl(247)})</p>
                  <p className="text-lg font-bold text-primary">{brl(2470 * rate)}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Pagamento via PIX todo dia <strong className="text-foreground">{payDay}</strong>, saldo mínimo <strong className="text-foreground">{brl(minPayout)}</strong>, processamento em até <strong className="text-foreground">{hours}h úteis</strong>.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-3">
              <Button
                size="lg"
                className="gradient-primary neon-glow-pink"
                onClick={onCtaClick}
              >
                Quero participar agora <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary/40 hover:bg-primary/10"
                onClick={() => window.open("https://uz4flow.lovable.app", "_blank")}
              >
                Como funciona
              </Button>
            </div>
          </div>

          {/* Side stats */}
          <div className="hidden md:flex flex-col gap-3 min-w-[180px]">
            <div className="quantum-glass p-4 rounded-lg border-primary/20">
              <Wallet className="w-5 h-5 text-primary mb-2" />
              <div className="text-2xl font-bold text-foreground">até {pct}%</div>
              <div className="text-xs text-muted-foreground">Comissão sobre cada pagamento</div>
            </div>
            <div className="quantum-glass p-4 rounded-lg border-primary/20">
              <Clock className="w-5 h-5 text-primary mb-2" />
              <div className="text-2xl font-bold text-foreground">{hours}h</div>
              <div className="text-xs text-muted-foreground">Para receber o saque</div>
            </div>
            <div className="quantum-glass p-4 rounded-lg border-primary/20">
              <BarChart3 className="w-5 h-5 text-primary mb-2" />
              <div className="text-2xl font-bold text-foreground">∞</div>
              <div className="text-xs text-muted-foreground">Sem teto de ganhos</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
