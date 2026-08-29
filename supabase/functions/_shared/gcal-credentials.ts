import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "./encryption.ts";

export interface GCalCredentials {
  clientId: string;
  clientSecret: string;
  source: "tenant" | "env";
}

/**
 * Fetches Google Calendar credentials for an organization.
 * Falls back to environment variables if tenant has none configured.
 */
export async function getGCalCredentials(
  organizationId: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<GCalCredentials | null> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data } = await supabase
    .from("google_calendar_credentials")
    .select("client_id, client_secret_encrypted")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (data?.client_id && data?.client_secret_encrypted) {
    const clientSecret = await decrypt(data.client_secret_encrypted);
    return { clientId: data.client_id, clientSecret, source: "tenant" };
  }

  // Fallback to env vars (backward compatibility)
  const clientId = (Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || Deno.env.get("GOOGLE_CLIENT_ID"))?.trim();
  const clientSecret = (Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || Deno.env.get("GOOGLE_CLIENT_SECRET"))?.trim();

  if (clientId && clientSecret) {
    return { clientId, clientSecret, source: "env" };
  }

  return null;
}
