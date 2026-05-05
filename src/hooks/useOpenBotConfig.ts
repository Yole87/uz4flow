import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";

interface InstanceWithOpenBot {
  id: string;
  name: string;
  openbot_instance_id: string | null;
  has_openbot_api_key: boolean;
  provider?: string;
  meta_phone_number_id?: string | null;
}

export function useOpenBotConfig() {
  const { data: organization } = useUserOrganization();
  const organizationId = organization?.id;

  // Query instances to check configuration status
  const { data: instances = [], isLoading, error } = useQuery({
    queryKey: ["openbot-instances-config", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("instances_safe" as any)
        .select("id, name, openbot_instance_id, has_openbot_api_key, provider, meta_phone_number_id")
        .eq("organization_id", organizationId);
      
      if (error) throw error;
      // Exclude Instagram accounts (they have their own management UI)
      const filtered = (data || []).filter(
        (i: any) => i.provider === "baileys" || i.provider === "meta_official",
      );
      return filtered as unknown as InstanceWithOpenBot[];
    },
    enabled: !!organizationId,
  });

  // Generate webhook URL for OpenBot to call
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-openbot-inbound`;

  // Check if at least one instance is fully configured
  const configuredInstances = instances.filter(
    i => i.openbot_instance_id && i.has_openbot_api_key
  );
  const isConfigured = configuredInstances.length > 0;

  // Count pending instances
  const pendingInstances = instances.filter(
    i => !i.openbot_instance_id || !i.has_openbot_api_key
  );

  return {
    instances,
    configuredInstances,
    pendingInstances,
    isLoading,
    error,
    webhookUrl,
    isConfigured,
    hasInstances: instances.length > 0,
  };
}
