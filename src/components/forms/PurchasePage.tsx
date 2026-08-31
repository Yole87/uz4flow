import { useState, useEffect } from "react";
import type { UzFormProduct } from "@/types/uzForm";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

interface PurchasePageProps {
  title?: string;
  subtitle?: string;
  products: UzFormProduct[];
  countdownTo?: string;
  watermarkText?: string;
  brandLogo?: React.ReactNode;
}

function useCountdown(targetIso?: string) {
  const [timeLeft, setTimeLeft] = useState<{ h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft({ h: 0, m: 0, s: 0 });
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ h, m, s });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return timeLeft;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function PurchasePage({
  title,
  subtitle,
  products,
  countdownTo,
  watermarkText,
  brandLogo,
}: PurchasePageProps) {
  const timeLeft = useCountdown(countdownTo);
  const hasCountdown = !!countdownTo && timeLeft !== null;
  const isSingle = products.length === 1;

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-10 gap-8">
      {/* Brand */}
      {brandLogo && <div>{brandLogo}</div>}

      {/* Success badge */}
      <div className="flex items-center gap-2 text-success">
        <CheckCircle className="h-5 w-5" />
        <span className="text-sm font-medium">Formulário enviado com sucesso!</span>
      </div>

      {/* Title */}
      {(title || subtitle) && (
        <div className="text-center space-y-1 max-w-xl">
          {title && <h2 className="text-2xl font-extrabold text-foreground">{title}</h2>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {/* Countdown */}
      {hasCountdown && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-6 py-3">
          <span className="text-xs font-medium text-destructive uppercase tracking-wide">
            Oferta expira em
          </span>
          <span className="font-mono text-xl font-bold text-destructive">
            {pad(timeLeft!.h)}:{pad(timeLeft!.m)}:{pad(timeLeft!.s)}
          </span>
        </div>
      )}

      {/* Products grid */}
      <div
        className={`w-full max-w-4xl grid gap-4 ${
          isSingle
            ? "grid-cols-1 max-w-sm"
            : products.length === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        {products.map((product) => (
          <div
            key={product.id}
            className={`relative flex flex-col rounded-2xl border-2 bg-card overflow-hidden transition-shadow hover:shadow-lg ${
              product.is_highlighted
                ? "border-primary shadow-md shadow-primary/20"
                : "border-border"
            }`}
          >
            {/* Highlight badge */}
            {product.is_highlighted && product.badge_text && (
              <div className="absolute top-0 left-0 right-0 flex justify-center">
                <span className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-b-lg">
                  {product.badge_text}
                </span>
              </div>
            )}

            {/* Image */}
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.title}
                className={`w-full object-cover aspect-video ${
                  product.is_highlighted && product.badge_text ? "mt-6" : ""
                }`}
              />
            )}

            <div className="flex flex-col flex-1 p-5 gap-3">
              {/* Title & subtitle */}
              <div
                className={
                  product.is_highlighted && product.badge_text && !product.image_url ? "mt-4" : ""
                }
              >
                <h3 className="text-lg font-bold text-foreground">{product.title}</h3>
                {product.subtitle && (
                  <p className="text-sm text-muted-foreground mt-0.5">{product.subtitle}</p>
                )}
              </div>

              {/* Pricing */}
              {(product.price_from || product.price_to) && (
                <div className="space-y-0.5">
                  {product.price_from && (
                    <p className="text-sm text-muted-foreground line-through">
                      De: {product.price_from}
                    </p>
                  )}
                  {product.price_to && (
                    <p className="text-xl font-extrabold text-foreground">
                      Por: {product.price_to}
                    </p>
                  )}
                </div>
              )}

              {/* CTA Button */}
              <div className="mt-auto pt-2">
                <Button
                  size="lg"
                  className={`w-full rounded-xl ${
                    product.is_highlighted ? "gradient-primary text-primary-foreground" : ""
                  }`}
                  onClick={() =>
                    window.open(product.cta_link, "_blank", "noopener,noreferrer")
                  }
                  disabled={!product.cta_link}
                >
                  {product.cta_text || "Comprar agora"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Watermark */}
      {watermarkText && (
        <p className="text-xs text-muted-foreground/60 text-center">{watermarkText}</p>
      )}
    </div>
  );
}
