import { CreditCard } from "lucide-react";
import { SettingsSection } from "../SettingsSection";
import { SubscriptionTab } from "../SubscriptionTab";

interface Props {
  onHelp: () => void;
}

export function SubscriptionSection({ onHelp }: Props) {
  return (
    <SettingsSection
      icon={CreditCard}
      title="Assinatura"
      description="Gerencie seu plano, ciclo de cobrança e funcionalidades inclusas."
      onHelpClick={onHelp}
    >
      <SubscriptionTab showStorage={false} />
    </SettingsSection>
  );
}
