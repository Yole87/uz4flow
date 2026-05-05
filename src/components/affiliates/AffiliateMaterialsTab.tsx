import { useState } from "react";
import { useAffiliate, useAffiliateSettings } from "@/hooks/useAffiliate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Sparkles, Link as LinkIcon, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AffiliateBanners } from "./AffiliateBanners";
import { AffiliateCopyTemplates } from "./AffiliateCopyTemplates";

export function AffiliateMaterialsTab() {
  const { data: affiliate } = useAffiliate();
  const { data: globalSettings } = useAffiliateSettings();
  const [campaign, setCampaign] = useState("");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["affiliate-settings-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliate_settings")
        .select("default_commission_percent")
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (!affiliate) return null;

  const pct = Number(settings?.default_commission_percent ?? 20);
  const base = `${window.location.origin}/?ref=${affiliate.code}`;
  const params = new URLSearchParams();
  if (source) params.set("utm_source", source);
  if (medium) params.set("utm_medium", medium);
  if (campaign) params.set("utm_campaign", campaign);
  const utmLink = params.toString() ? `${base}&${params.toString()}` : base;

  const copy = (v: string, label = "Copiado") => {
    navigator.clipboard.writeText(v);
    toast.success(`${label}!`);
  };

  return (
    <div className="space-y-6">
      {/* Hero: code + base link */}
      <Card className="quantum-glass border-primary/40 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/10 pointer-events-none" />
        <CardContent className="relative p-6">
          <div className="grid md:grid-cols-[auto_1fr] gap-6 items-center">
            {/* Code badge */}
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1.5">Seu código</div>
              <Badge className="text-2xl px-5 py-2.5 gradient-primary text-white font-mono font-black border-0 shadow-lg shadow-primary/30">
                {affiliate.code}
              </Badge>
              <button
                onClick={() => copy(affiliate.code, "Código")}
                className="block mx-auto mt-2 text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> copiar código
              </button>
            </div>

            {/* Base link */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-foreground">
                <LinkIcon className="w-4 h-4 text-primary" />
                Seu link de indicação
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={base}
                  className="bg-primary/5 border-primary/40 text-primary font-mono font-semibold text-sm"
                />
                <Button onClick={() => copy(base, "Link")} className="gradient-primary shrink-0">
                  <Copy className="w-4 h-4 mr-2" /> Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Você ganha <span className="text-primary font-bold">até {pct}% recorrente</span> em cada cliente que assinar pelo seu link.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {globalSettings && !globalSettings.allow_self_referral && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-warning/40 bg-warning/10">
          <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            <strong>Auto-indicação não é permitida:</strong> assinaturas feitas com seu próprio link/e-mail <strong>não geram comissão</strong>.
          </p>
        </div>
      )}

      {/* UTM generator */}
      <Card className="quantum-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gerador de link com UTM (rastreamento avançado)
          </CardTitle>
          <p className="text-sm text-muted-foreground">Use UTMs para saber qual canal está trazendo mais conversões.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Source (origem)</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="instagram, facebook…" />
            </div>
            <div>
              <Label>Medium (mídia)</Label>
              <Input value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="story, post, reels…" />
            </div>
            <div>
              <Label>Campaign (campanha)</Label>
              <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="lancamento_jan" />
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              readOnly
              value={utmLink}
              className="bg-primary/5 border-primary/40 text-primary font-mono font-semibold text-xs"
            />
            <Button variant="outline" className="border-primary/40 hover:bg-primary/10 shrink-0" onClick={() => copy(utmLink, "Link UTM")}>
              <Copy className="w-4 h-4 mr-2" /> Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Banners desativados temporariamente */}
      {/* <AffiliateBanners link={base} code={affiliate.code} pct={pct} /> */}

      {/* Copy templates + scripts + tips */}
      <AffiliateCopyTemplates link={base} pct={pct} />
    </div>
  );
}
