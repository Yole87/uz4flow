import { HardDrive } from "lucide-react";
import { SettingsSection } from "../SettingsSection";
import { StorageUsageCard } from "@/components/StorageUsageCard";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

interface Props {
  onHelp: () => void;
}

export function StorageSection({ onHelp }: Props) {
  return (
    <SettingsSection
      icon={HardDrive}
      title="Armazenamento"
      description="Acompanhe o uso de espaço da sua organização."
      onHelpClick={onHelp}
    >
      <StorageUsageCard />

      <Card className="border-border/60">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-4 w-4 text-accent mt-0.5 shrink-0" />
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Como liberar espaço</p>
              <ul className="list-disc list-inside text-xs space-y-1 leading-relaxed">
                <li>Remova mídias antigas de conversas no CRM (mensagens enviadas/recebidas).</li>
                <li>Apague anexos de contatos que não são mais necessários.</li>
                <li>Faça upgrade de plano para aumentar seu limite de armazenamento.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </SettingsSection>
  );
}
