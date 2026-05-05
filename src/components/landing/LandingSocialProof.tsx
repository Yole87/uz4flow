import { Layers, Smartphone, ShieldCheck } from "lucide-react";

export function LandingSocialProof() {
  return (
    <section className="py-10 md:py-14">
      <div className="container mx-auto px-4">
        <div className="quantum-glass rounded-xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 text-center md:text-left">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Layers className="w-4 h-4 text-primary" />
              <Smartphone className="w-4 h-4 text-secondary" />
              <ShieldCheck className="w-4 h-4 text-success" />
            </div>
            <p className="font-terminal text-xs md:text-sm uppercase tracking-widest text-muted-foreground">
              Construído para escalar.{" "}
              <span className="text-foreground/80">
                Arquitetura multi-tenant, PWA instalável, conformidade LGPD.
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
