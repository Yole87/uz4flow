import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BrandingSettings {
  favicon_url?: string;
  pwa_icon_192_url?: string;
  pwa_icon_512_url?: string;
  logo_url?: string;
  og_image_url?: string;
  theme_color?: string;
  meta_description?: string;
  social_links?: { instagram?: string; youtube?: string; linkedin?: string };
  analytics_id?: string;
  maintenance_mode?: boolean;
  maintenance_message?: string;
}

interface GeneralSettings {
  app_name?: string;
}

const FALLBACK_LOGO = "/favicon.png";

function updateMetaTag(selector: string, attribute: string, value: string) {
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    const parts = selector.match(/\[(.+?)="(.+?)"\]/);
    if (parts) el.setAttribute(parts[1], parts[2]);
    document.head.appendChild(el);
  }
  el.setAttribute(attribute, value);
}

function updateLinkTag(rel: string, href: string, type?: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
  if (type) el.type = type;
}

let analyticsInjected = "";

interface BrandingData {
  branding: BrandingSettings;
  general: GeneralSettings;
}

async function fetchBranding(): Promise<BrandingData> {
  const { data } = await supabase
    .from("saas_settings")
    .select("key, value")
    .in("key", ["branding", "general"]);

  let b: BrandingSettings = {};
  let g: GeneralSettings = {};
  data?.forEach((row) => {
    if (row.key === "branding") b = (row.value ?? {}) as unknown as BrandingSettings;
    if (row.key === "general") g = (row.value ?? {}) as unknown as GeneralSettings;
  });
  return { branding: b, general: g };
}

export function useBranding() {
  const { data } = useQuery({
    queryKey: ["branding"],
    queryFn: fetchBranding,
    staleTime: 1000 * 30,
    refetchOnMount: true,
  });

  const b = data?.branding ?? {};
  const g = data?.general ?? {};

  useEffect(() => {
    if (!data) return;

    if (g.app_name) document.title = g.app_name;
    if (b.favicon_url) updateLinkTag("icon", b.favicon_url, "image/png");
    if (b.pwa_icon_192_url) updateLinkTag("apple-touch-icon", b.pwa_icon_192_url);

    if (b.meta_description) {
      updateMetaTag('meta[name="description"]', "content", b.meta_description);
      updateMetaTag('meta[property="og:description"]', "content", b.meta_description);
      updateMetaTag('meta[name="twitter:description"]', "content", b.meta_description);
    }
    if (b.og_image_url) {
      updateMetaTag('meta[property="og:image"]', "content", b.og_image_url);
      updateMetaTag('meta[name="twitter:image"]', "content", b.og_image_url);
    }
    if (g.app_name) {
      updateMetaTag('meta[property="og:title"]', "content", g.app_name);
      updateMetaTag('meta[name="twitter:title"]', "content", g.app_name);
    }
    if (b.theme_color) {
      updateMetaTag('meta[name="theme-color"]', "content", b.theme_color);
    }

    if (b.analytics_id && b.analytics_id !== analyticsInjected) {
      analyticsInjected = b.analytics_id;
      if (b.analytics_id.startsWith("G-") || b.analytics_id.startsWith("UA-")) {
        const s = document.createElement("script");
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${b.analytics_id}`;
        document.head.appendChild(s);
        const s2 = document.createElement("script");
        s2.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${b.analytics_id}');`;
        document.head.appendChild(s2);
      } else if (b.analytics_id.startsWith("GTM-")) {
        const s = document.createElement("script");
        s.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${b.analytics_id}');`;
        document.head.appendChild(s);
      }
    }

    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (manifestLink) {
      manifestLink.href = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pwa-manifest`;
    }
  }, [data]);

  return b;
}

/**
 * Returns the best available logo URL from branding settings,
 * with a static fallback. Use this for any sidebar/header/auth logo.
 */
export function useBrandingLogo(): string {
  const b = useBranding();
  return b?.logo_url || b?.favicon_url || b?.pwa_icon_192_url || FALLBACK_LOGO;
}

export function useBrandingAppName(): string {
  const { data } = useQuery({
    queryKey: ["branding"],
    queryFn: fetchBranding,
    staleTime: 1000 * 30,
    refetchOnMount: true,
  });

  return data?.general?.app_name || "Uz4Flow";
}
