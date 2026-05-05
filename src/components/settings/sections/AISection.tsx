import { Brain } from "lucide-react";
import { SettingsSection } from "../SettingsSection";
import { AIConfigCard } from "../AIConfigCard";

interface Props {
  onHelp: () => void;
}

export function AISection({ onHelp }: Props) {
  return (
    <SettingsSection
      icon={Brain}
      title="Inteligência Artificial"
      description="Escolha o modelo, ajuste o prompt e personalize as respostas geradas pela IA."
      onHelpClick={onHelp}
    >
      <AIConfigCard />
    </SettingsSection>
  );
}
