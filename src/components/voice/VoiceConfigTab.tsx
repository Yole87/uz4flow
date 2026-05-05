import { Phone } from "lucide-react";
import { ServiceConfigSection } from "@/components/settings/ServiceConfigSection";
import { VapiConfigCard } from "@/components/crm/settings/VapiConfigCard";

const vapiTutorialSteps = [
  {
    title: "Crie sua conta no Vapi",
    description:
      "Acesse vapi.ai e crie uma conta gratuita. Você receberá créditos iniciais para testar.",
  },
  {
    title: "Obtenha sua Private API Key",
    description:
      'No dashboard do Vapi, vá em "Settings" → "API Keys" e copie sua Private API Key.',
  },
  {
    title: "Importe um número do Twilio",
    description:
      'Em "Phone Numbers" no Vapi, clique em "Import from Twilio" e siga as instruções para conectar seu número de telefone.',
  },
  {
    title: "Copie o Phone Number ID",
    description:
      "Após importar o número, copie o ID exibido na lista de números do Vapi.",
  },
  {
    title: "Configure a voz (Voice ID)",
    description:
      'Em "Voices" no Vapi, escolha uma voz disponível ou crie uma personalizada e copie o Voice ID.',
  },
];

export function VoiceConfigTab() {
  return (
    <ServiceConfigSection
      title="Voice AI (Vapi)"
      icon={Phone}
      tutorialVideoId="_8ZH1-o8mNM"
      tutorialVideoTitle="Como configurar o Voice AI"
      tutorialSteps={vapiTutorialSteps}
    >
      <VapiConfigCard />
    </ServiceConfigSection>
  );
}
