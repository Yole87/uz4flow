import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useAffiliate, useAffiliateSettings } from "@/hooks/useAffiliate";
import { AffiliateOnboardingForm } from "@/components/affiliates/AffiliateOnboardingForm";
import { AffiliateOverviewTab } from "@/components/affiliates/AffiliateOverviewTab";
import { AffiliateReferralsTab } from "@/components/affiliates/AffiliateReferralsTab";
import { AffiliatePayoutsTab } from "@/components/affiliates/AffiliatePayoutsTab";
import { AffiliateMaterialsTab } from "@/components/affiliates/AffiliateMaterialsTab";
import { AffiliateHero } from "@/components/affiliates/AffiliateHero";
import { Handshake, Loader2, Lock, Percent, Wallet, CalendarDays, Cookie } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useRef, useState } from "react";

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Affiliates() {
  const { data: affiliate, isLoading } = useAffiliate();
  const { data: settings, isLoading: settingsLoading } = useAffiliateSettings();
  const [tab, setTab] = useState("overview");
  const onboardingRef = useRef<HTMLDivElement>(null);

  const programEnabled = settings?.program_enabled !== false;
  const loading = isLoading || settingsLoading;

  // Program disabled globally — show empty state
  if (!loading && !programEnabled && !affiliate) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Card className="quantum-glass max-w-2xl mx-auto mt-12">
            <CardContent className="p-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Programa de Afiliados temporariamente indisponível</h2>
              <p className="text-muted-foreground">
                Estamos ajustando os termos do programa. Volte em breve para participar e ganhar comissão recorrente sobre cada indicação.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const scrollToOnboarding = () => {
    onboardingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Commercial hero */}
        {!loading && (
          affiliate ? (
            <AffiliateHero variant="compact" onCtaClick={() => setTab("materials")} />
          ) : (
            <AffiliateHero variant="full" onCtaClick={scrollToOnboarding} />
          )
        )}

        {/* Card de regras vigentes — sempre visível para afiliados (após cadastro) */}
        {affiliate && settings && (
          <Card className="quantum-glass border-primary/20">
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center">
                  <Percent className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Comissão</p>
                  <p className="text-sm font-bold text-foreground">
                    {settings.default_commission_percent}% {settings.commission_type === "recurring" ? "recorrente" : "única"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saque mínimo</p>
                  <p className="text-sm font-bold text-foreground">{brl(settings.min_payout)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pagamento</p>
                  <p className="text-sm font-bold text-foreground">
                    Dia {settings.payout_day_of_month} · {settings.payout_processing_hours}h úteis
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Cookie className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cookie de atribuição</p>
                  <p className="text-sm font-bold text-foreground">{settings.attribution_window_days} dias</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {affiliate && settings && <Separator className="my-2" />}

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center neon-glow-pink">
            <Handshake className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Programa de Afiliados</h1>
            <p className="text-sm text-muted-foreground">
              Indique e ganhe comissão sobre cada nova assinatura paga
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !affiliate ? (
          <div ref={onboardingRef}>
            <AffiliateOnboardingForm />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              {affiliate.status === "approved" && <TabsTrigger value="referrals">Indicados</TabsTrigger>}
              {affiliate.status === "approved" && <TabsTrigger value="payouts">Saques</TabsTrigger>}
              {affiliate.status === "approved" && <TabsTrigger value="materials">Materiais</TabsTrigger>}
            </TabsList>
            <TabsContent value="overview"><AffiliateOverviewTab /></TabsContent>
            {affiliate.status === "approved" && (
              <>
                <TabsContent value="referrals"><AffiliateReferralsTab /></TabsContent>
                <TabsContent value="payouts"><AffiliatePayoutsTab /></TabsContent>
                <TabsContent value="materials"><AffiliateMaterialsTab /></TabsContent>
              </>
            )}
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
