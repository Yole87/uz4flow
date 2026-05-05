import { Bot } from "lucide-react";
import { SettingsSection } from "../SettingsSection";
import { InstanceStatusList } from "../InstanceStatusList";
import { NewInstanceButton } from "../NewInstanceButton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Instagram } from "lucide-react";

interface Props {
  onHelp: () => void;
}

export function WhatsAppSection({ onHelp }: Props) {
  const { data: organization } = useUserOrganization();

  const { data: hasInstances } = useQuery({
    queryKey: ["whatsapp-section-has-instances", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return false;
      const { data } = await supabase
        .from("instances_safe" as any)
        .select("id")
        .eq("organization_id", organization.id)
        .in("provider", ["baileys", "meta_official"])
        .limit(1);
      return (data || []).length > 0;
    },
    enabled: !!organization?.id,
  });

  return (
    <SettingsSection
      icon={Bot}
      title="WhatsApp"
      description="Conecte instâncias do Sistema de WhatsApp AI à sua organização."
      actions={hasInstances ? <NewInstanceButton variant="button" /> : undefined}
      onHelpClick={onHelp}
    >
      {hasInstances ? (
        <InstanceStatusList />
      ) : (
        <NewInstanceButton variant="card" />
      )}

      <div className="flex items-start gap-2.5 p-3 rounded-md bg-muted/40 border border-border/50">
        <Instagram className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Contas do <strong>Instagram</strong> são gerenciadas em <strong>Instagram → Contas</strong>, em uma seção dedicada.
        </p>
      </div>
    </SettingsSection>
  );
}
