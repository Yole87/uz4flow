import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Auto-migrate data from the `integrations` table (per-user, for Flows)
 * into the `instances` table (per-org) if the org has no instances yet.
 */
export function useAutoMigrateIntegration() {
  const { user } = useAuth();
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  const didRun = useRef(false);

  useEffect(() => {
    if (!user || !organization?.id || didRun.current) return;
    didRun.current = true;

    (async () => {
      try {
        // Check if org already has instances
        const { data: existingInstances } = await supabase
          .from("instances")
          .select("id")
          .eq("organization_id", organization.id)
          .limit(1);

        if (existingInstances && existingInstances.length > 0) return;

        // Check if user has data in integrations
        const { data: integration } = await supabase
          .from("integrations")
          .select("openbot_api_key_encrypted, openbot_inbound_url")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!integration?.openbot_api_key_encrypted) return;

        // Create instance from integration data
        const { error } = await supabase.from("instances").insert({
          name: "Instância Principal",
          organization_id: organization.id,
          openbot_api_key_encrypted: integration.openbot_api_key_encrypted,
          api_url: integration.openbot_inbound_url || "https://api.digitalbotia.com.br/sendWebhook",
          provider: "baileys",
          status: "connected",
        });

        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["settings-instances"] });
        }
      } catch (e) {
        console.error("Auto-migration error:", e);
      }
    })();
  }, [user, organization?.id]);
}
