import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, ImageIcon, Eye } from "lucide-react";
import { toast } from "sonner";

interface BannerSpec {
  label: string;
  width: number;
  height: number;
  description: string;
}

const BANNERS: BannerSpec[] = [
  { label: "Feed Quadrado", width: 1080, height: 1080, description: "Instagram feed, LinkedIn" },
  { label: "Story / Reels", width: 1080, height: 1920, description: "Stories, Reels, TikTok" },
  { label: "Banner Horizontal", width: 1200, height: 630, description: "Facebook, OG image, e-mail" },
];

const FALLBACK_LINK = "https://openflow.studio";

// Escape XML/SVG special chars to neutralize injection via interpolated user input.
function escapeXml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isSafeHttpsUrl(u: string): boolean {
  if (!u || typeof u !== "string") return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function bannerSvg(spec: BannerSpec, link: string, code: string, pct: number, forPreview = false): string {
  const isVertical = spec.height > spec.width;
  const isWide = spec.width > spec.height * 1.5;
  const titleSize = isVertical ? 96 : isWide ? 72 : 88;
  const subSize = isVertical ? 44 : isWide ? 32 : 40;
  const ctaSize = isVertical ? 38 : isWide ? 28 : 34;
  const padding = isVertical ? 80 : 60;

  const sizeAttrs = forPreview
    ? `width="100%" height="100%" preserveAspectRatio="xMidYMid meet"`
    : `width="${spec.width}" height="${spec.height}"`;

  const safePct = escapeXml(String(Number(pct) || 0));
  const safeLinkText = escapeXml(String(link).replace(/^https?:\/\//, ""));
  // `code` is currently unused in the SVG, but escape defensively in case it ever lands here.
  void escapeXml(String(code || ""));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs} viewBox="0 0 ${spec.width} ${spec.height}">
  <defs>
    <linearGradient id="bg-${spec.width}x${spec.height}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a0b2e"/>
      <stop offset="50%" stop-color="#2d1b4e"/>
      <stop offset="100%" stop-color="#0f0820"/>
    </linearGradient>
    <linearGradient id="accent-${spec.width}x${spec.height}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <radialGradient id="glow-${spec.width}x${spec.height}" cx="80%" cy="20%" r="50%">
      <stop offset="0%" stop-color="#ec4899" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#ec4899" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${spec.width}" height="${spec.height}" fill="url(#bg-${spec.width}x${spec.height})"/>
  <rect width="${spec.width}" height="${spec.height}" fill="url(#glow-${spec.width}x${spec.height})"/>
  <g font-family="system-ui, -apple-system, sans-serif" fill="white">
    <text x="${padding}" y="${padding + 60}" font-size="${ctaSize}" font-weight="700" fill="#ec4899" letter-spacing="4">OPENFLOW · AFILIADOS</text>
    <text x="${padding}" y="${spec.height / 2 - titleSize / 2}" font-size="${titleSize}" font-weight="900">Ganhe até</text>
    <text x="${padding}" y="${spec.height / 2 + titleSize / 2 + 10}" font-size="${titleSize * 1.4}" font-weight="900" fill="url(#accent-${spec.width}x${spec.height})">${safePct}%</text>
    <text x="${padding}" y="${spec.height / 2 + titleSize * 1.4 + 50}" font-size="${subSize}" font-weight="600" opacity="0.95">comissão recorrente</text>
    <text x="${padding}" y="${spec.height - padding - 60}" font-size="${ctaSize}" font-weight="700" opacity="0.9">Acesse com meu link:</text>
    <text x="${padding}" y="${spec.height - padding - 10}" font-size="${ctaSize}" font-weight="900" fill="#ec4899">${safeLinkText}</text>
  </g>
</svg>`;
}

function downloadSvg(spec: BannerSpec, link: string, code: string, pct: number) {
  const svg = bannerSvg(spec, link, code, pct, false);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `openflow-afiliado-${spec.width}x${spec.height}.svg`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("SVG baixado!");
}

async function downloadPng(spec: BannerSpec, link: string, code: string, pct: number) {
  try {
    const svg = bannerSvg(spec, link, code, pct, false);
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Falha ao carregar SVG"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = spec.width;
    canvas.height = spec.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não suportado");
    ctx.drawImage(img, 0, 0, spec.width, spec.height);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Falha ao gerar PNG");
        return;
      }
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `openflow-afiliado-${spec.width}x${spec.height}.png`;
      a.click();
      URL.revokeObjectURL(pngUrl);
      toast.success("PNG baixado!");
    }, "image/png");
  } catch (e: any) {
    toast.error(e?.message || "Erro ao exportar PNG");
  }
}

export function AffiliateBanners({ link, code, pct }: { link: string; code: string; pct: number }) {
  const [previewBanner, setPreviewBanner] = useState<BannerSpec | null>(null);

  // Validate link once: only accept https:// URLs. Fall back to brand URL for rendering,
  // but disable downloads so users notice and fix the affiliate link.
  const linkIsValid = useMemo(() => isSafeHttpsUrl(link), [link]);
  const safeLink = linkIsValid ? link : FALLBACK_LINK;

  const handleInvalidLink = () => {
    toast.error("Link de afiliado inválido — use uma URL https://");
  };

  return (
    <>
      <Card className="quantum-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            Banners prontos para divulgar
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            3 formatos com seu link já embutido. Baixe em PNG (compatível com todas as redes) ou SVG (alta qualidade vetorial).
          </p>
          {!linkIsValid && (
            <p className="text-xs text-destructive mt-2">
              Link de afiliado inválido (precisa começar com https://). Os downloads ficam desabilitados até corrigir.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BANNERS.map((b) => (
              <div key={b.label} className="space-y-2.5">
                <div
                  className="relative w-full rounded-lg overflow-hidden border border-primary/20 bg-[#0f0820] cursor-zoom-in group"
                  style={{ aspectRatio: `${b.width}/${b.height}`, maxHeight: 380 }}
                  onClick={() => setPreviewBanner(b)}
                  dangerouslySetInnerHTML={{ __html: bannerSvg(b, safeLink, code, pct, true) }}
                />
                <div>
                  <p className="text-sm font-semibold">{b.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.width}×{b.height} • {b.description}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setPreviewBanner(b)}>
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Visualizar
                  </Button>
                  <Button
                    size="sm"
                    className="w-full gradient-primary"
                    disabled={!linkIsValid}
                    onClick={() => (linkIsValid ? downloadPng(b, safeLink, code, pct) : handleInvalidLink())}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar PNG
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!linkIsValid}
                    onClick={() => (linkIsValid ? downloadSvg(b, safeLink, code, pct) : handleInvalidLink())}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar SVG
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!previewBanner} onOpenChange={(open) => !open && setPreviewBanner(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {previewBanner?.label} — {previewBanner?.width}×{previewBanner?.height}
            </DialogTitle>
          </DialogHeader>
          {previewBanner && (
            <div className="space-y-3">
              <div
                className="w-full rounded-lg overflow-hidden border border-primary/20 bg-[#0f0820] mx-auto"
                style={{
                  aspectRatio: `${previewBanner.width}/${previewBanner.height}`,
                  maxHeight: "70vh",
                  maxWidth: previewBanner.height > previewBanner.width ? "50vh" : "100%",
                }}
                dangerouslySetInnerHTML={{ __html: bannerSvg(previewBanner, safeLink, code, pct, true) }}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  disabled={!linkIsValid}
                  onClick={() => (linkIsValid ? downloadSvg(previewBanner, safeLink, code, pct) : handleInvalidLink())}
                >
                  <Download className="w-4 h-4 mr-2" /> SVG
                </Button>
                <Button
                  className="gradient-primary"
                  disabled={!linkIsValid}
                  onClick={() => (linkIsValid ? downloadPng(previewBanner, safeLink, code, pct) : handleInvalidLink())}
                >
                  <Download className="w-4 h-4 mr-2" /> Baixar PNG
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
