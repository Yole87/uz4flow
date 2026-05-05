/**
 * Shared CORS configuration for Edge Functions.
 * 
 * - Authenticated functions: restrict to allowed origins
 * - Public webhooks: use permissive CORS (wildcard)
 */

const ALLOWED_ORIGINS = [
  "https://openbot-connector.lovable.app",
  "https://openflow.studio",
  "https://www.openflow.studio",
];

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/.*--dff2aabe-4f5d-4bfb-8ad0-dc92d710f5f9\.lovable\.app$/,
  /^https:\/\/id-preview--dff2aabe-4f5d-4bfb-8ad0-dc92d710f5f9\.lovable\.app$/,
  /^https:\/\/dff2aabe-4f5d-4bfb-8ad0-dc92d710f5f9\.lovableproject\.com$/,
  /^https:\/\/.*\.lovableproject\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
}

const BASE_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

/**
 * Returns CORS headers scoped to the request origin (if allowed).
 * Falls back to the published URL if origin is missing or not allowed.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = isOriginAllowed(origin) ? origin! : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": BASE_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

/**
 * Permissive CORS for public webhooks (no auth, external callers).
 */
export const publicCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": BASE_HEADERS,
};

/**
 * Security headers included in all Edge Function responses.
 */
export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

/**
 * Handle CORS preflight for authenticated functions.
 */
export function handleCorsOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}
