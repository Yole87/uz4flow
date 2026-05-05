import { Zap } from "lucide-react";
import { SettingsSection } from "../SettingsSection";
import { QuickReplyManager } from "@/components/crm/QuickReplyManager";

interface Props {
  onHelp: () => void;
}

export function QuickRepliesSection({ onHelp }: Props) {
  return (
    <SettingsSection
      icon={Zap}
      title="Respostas Rápidas"
      description='Crie atalhos de mensagens para acelerar o atendimento. Use "/" no chat para invocá-las.'
      onHelpClick={onHelp}
    >
      <QuickReplyManager />
    </SettingsSection>
  );
}
