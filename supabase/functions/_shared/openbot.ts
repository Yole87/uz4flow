/**
 * Shared OpenBot send helper.
 *
 * Centralizes the standard OpenBot `sendWebhook` POST used by multiple
 * Edge Functions. Wraps `fetchWithRetry` with the canonical payload shape.
 *
 * Payload key order is preserved to be byte-identical with previous
 * inline implementations: { apiKey, phone, message, [desativarFluxo], ...extra }.
 */
import { fetchWithRetry } from "./fetchWithRetry.ts";

export const OPENBOT_SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";

export interface OpenBotSendParams {
  apiKey: string;
  phone: string;
  message: string;
  desativarFluxo?: boolean;
  extra?: Record<string, unknown>;
}

export async function sendOpenBotMessage(params: OpenBotSendParams): Promise<Response> {
  const payload: Record<string, unknown> = {
    apiKey: params.apiKey,
    phone: params.phone,
    message: params.message,
    ...(params.desativarFluxo !== undefined ? { desativarFluxo: params.desativarFluxo } : {}),
    ...(params.extra || {}),
  };
  return fetchWithRetry(
    OPENBOT_SEND_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    { retries: 3, delay: 300 },
  );
}
