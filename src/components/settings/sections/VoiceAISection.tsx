import { Phone } from "lucide-react";
import { SettingsSection } from "../SettingsSection";
import { VapiConfigCard } from "@/components/crm/settings/VapiConfigCard";

interface Props {
  onHelp: () => void;
}

export function VoiceAISection({ onHelp }: Props) {
  return (
    <SettingsSection
      icon={Phone}
      title="Voice AI (Vapi)"
      description="Configure ligações automáticas com inteligência artificial."
      onHelpClick={onHelp}
    >
      <VapiConfigCard />
    </SettingsSection>
  );
}
