import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAffiliateSettings } from "@/hooks/useAffiliate";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAccept: (version: number) => void;
}

export function AffiliateTermsDialog({ open, onOpenChange, onAccept }: Props) {
  const { data: settings } = useAffiliateSettings();
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { data: terms } = useQuery({
    queryKey: ["affiliate-terms-current"],
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliate_terms_versions")
        .select("*")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setScrolledToEnd(false);
      setAgreed(false);
    }
  }, [open]);

  // Attach scroll listener directly to the Radix viewport (real scroll container)
  useEffect(() => {
    if (!open || !terms) return;

    // Defer to next tick so ScrollArea is mounted
    const timer = setTimeout(() => {
      const root = scrollAreaRef.current;
      if (!root) return;
      const viewport = root.querySelector<HTMLDivElement>("[data-radix-scroll-area-viewport]");
      if (!viewport) return;

      const checkScroll = () => {
        const reachedEnd = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 48;
        if (reachedEnd) setScrolledToEnd(true);
      };

      // Fallback: short content (no scroll needed)
      if (viewport.scrollHeight <= viewport.clientHeight + 48) {
        setTimeout(() => setScrolledToEnd(true), 800);
        return;
      }

      viewport.addEventListener("scroll", checkScroll, { passive: true });
      return () => viewport.removeEventListener("scroll", checkScroll);
    }, 100);

    return () => clearTimeout(timer);
  }, [open, terms]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Termos do Programa de Afiliados</DialogTitle>
        </DialogHeader>
        <ScrollArea ref={scrollAreaRef} className="h-[400px] rounded border border-border p-4 quantum-scrollbar">
          <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap">
            {terms?.body_md || "Carregando termos..."}
          </div>
        </ScrollArea>
        <div className="flex items-start gap-2 pt-2">
          <Checkbox
            id="agree"
            checked={agreed}
            disabled={!scrolledToEnd}
            onCheckedChange={(v) => setAgreed(!!v)}
          />
          <label htmlFor="agree" className="text-sm text-muted-foreground leading-snug">
            Li e concordo com os termos acima, incluindo a taxa fixa de <strong>{settings?.tax_percent ?? 6}%</strong> sobre o valor bruto do saque (imposto retido na fonte) e o prazo de pagamento de até <strong>{settings?.payout_processing_hours ?? 72} horas úteis</strong> após a solicitação.
            {!scrolledToEnd && <span className="block text-xs text-warning mt-1">Role até o fim para habilitar.</span>}
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!agreed || !terms}
            onClick={() => {
              onAccept(terms.version);
              onOpenChange(false);
            }}
          >
            Aceitar e continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
