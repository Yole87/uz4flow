// Affiliate referral tracking utilities (frontend)
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "of_ref";
const STORAGE_TS_KEY = "of_ref_ts";
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function captureRefFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("ref");
    if (code && /^[A-Z0-9]{4,32}$/i.test(code)) {
      const upper = code.toUpperCase();
      localStorage.setItem(STORAGE_KEY, upper);
      localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
      // Fire-and-forget tracking
      void supabase.functions.invoke("affiliate-track", {
        body: {
          code: upper,
          referer: document.referrer || null,
          landing_page: window.location.pathname + window.location.search,
          utm_source: url.searchParams.get("utm_source"),
          utm_medium: url.searchParams.get("utm_medium"),
          utm_campaign: url.searchParams.get("utm_campaign"),
        },
      });
      return upper;
    }
  } catch {
    // ignore
  }
  return null;
}

export function getStoredRefCode(): string | null {
  if (typeof window === "undefined") return null;
  const ts = Number(localStorage.getItem(STORAGE_TS_KEY) || 0);
  if (!ts || Date.now() - ts > WINDOW_MS) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TS_KEY);
    return null;
  }
  return localStorage.getItem(STORAGE_KEY);
}

export function clearRefCode() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_TS_KEY);
}
