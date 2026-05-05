# Padrão: Configuração de Serviços (service-config-pattern)

## Estrutura

Toda página de configuração de serviço segue 3 blocos:

1. **Credenciais e Configurações** — Cards de API keys, toggles, seletores
2. **Vídeo Tutorial** — Embed YouTube (ou placeholder "em breve")
3. **Tutorial Passo a Passo** — Accordion com passos numerados

## Componentes

| Componente | Caminho | Props principais |
|---|---|---|
| `ServiceConfigSection` | `src/components/settings/ServiceConfigSection.tsx` | `title`, `icon`, `children`, `tutorialVideoId?`, `tutorialVideoTitle?`, `tutorialVideoDescription?`, `tutorialSteps?` |
| `ServiceTutorialVideo` | `src/components/settings/ServiceTutorialVideo.tsx` | `videoId?`, `title?`, `description?` |
| `ServiceTutorialSteps` | `src/components/settings/ServiceTutorialSteps.tsx` | `steps: { title, description }[]` |

## Como usar para um novo serviço

```tsx
import { ServiceConfigSection } from "@/components/settings/ServiceConfigSection";
import { Instagram } from "lucide-react";

<ServiceConfigSection
  title="Instagram"
  icon={Instagram}
  tutorialVideoId="dQw4w9WgXcQ"
  tutorialVideoTitle="Como conectar sua conta do Instagram"
  tutorialSteps={[
    { title: "Passo 1", description: "Faça X..." },
    { title: "Passo 2", description: "Faça Y..." },
  ]}
>
  {/* Cards de credenciais específicos do serviço */}
  <MyServiceCredentialsCard />
</ServiceConfigSection>
```

## Primeira implementação

- Prospecção de IA: `src/components/crm/prospection/ProviderConfigCard.tsx`
