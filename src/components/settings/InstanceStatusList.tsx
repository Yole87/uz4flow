import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { InstanceDetailCard } from "./InstanceDetailCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, Instagram } from "lucide-react";

interface InstanceSafe {
  id: string;
  name: string;
  provider: string;
  openbot_instance_id: string | null;
  has_openbot_api_key: boolean;
  api_url: string | null;
}

export function InstanceStatusList() {
  const { data: organization } = useUserOrganization();

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["settings-instances", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from("instances_safe" as any)
        .select("id, name, provider, openbot_instance_id, has_openbot_api_key, api_url")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: true });
      return (data || []) as unknown as InstanceSafe[];
    },
    enabled: !!organization?.id,
  });

  // Only show WhatsApp instances here. Instagram accounts are managed in the Instagram menu.
  const whatsappInstances = instances.filter(
    (i) => i.provider === "baileys" || i.provider === "meta_official",
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Status das Instâncias WhatsApp</h3>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Instagram className="h-3.5 w-3.5" />
          Contas Instagram são gerenciadas em <strong>Instagram → Contas</strong>
        </p>
      </div>

      {whatsappInstances.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg text-sm text-muted-foreground">
          Nenhuma instância WhatsApp cadastrada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {whatsappInstances.map((instance) => (
            <InstanceDetailCard key={instance.id} instance={instance} />
          ))}
        </div>
      )}
    </div>
  );
}
