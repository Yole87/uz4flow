/**
 * Checkout Intent
 * 
 * Persists the user's selected plan from the landing page so that
 * after sign-up / login they are sent directly to the checkout
 * instead of falling back to the dashboard or the LP.
 */
const KEY = "of_checkout_intent";
const TTL_MS = 1000 * 60 * 60; // 1 hour

export interface CheckoutIntent {
  planId: string;
  cycle?: string;
  ts: number;
}

export function saveCheckoutIntent(planId: string, cycle?: string): void {
  try {
    const intent: CheckoutIntent = { planId, cycle, ts: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(intent));
  } catch { /* ignore */ }
}

export function getCheckoutIntent(): CheckoutIntent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutIntent;
    if (!parsed?.planId || !parsed.ts) return null;
    if (Date.now() - parsed.ts > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCheckoutIntent(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function buildCheckoutUrl(intent: CheckoutIntent): string {
  const cycle = intent.cycle ? `?cycle=${intent.cycle}` : "";
  return `/checkout/${intent.planId}${cycle}`;
}
