## Botão "Testar som" no toggle de notificação

Adicionar um botão dedicado ao lado do toggle 🔔/🔕 no header do CRM que toca o "ding" imediatamente, ignorando o throttle e o estado ligado/desligado — útil para validar que o áudio funciona no navegador.

### Comportamento

- Novo botão ícone (Volume2) ao lado do toggle 🔔, visível tanto no header desktop quanto no mobile.
- Ao clicar: toca o som imediatamente, mesmo que o toggle esteja desligado e mesmo dentro da janela de throttle de 2s.
- Tooltip: "Testar som de notificação".
- Se o navegador bloquear o autoplay, falha silenciosamente (sem erro visível) — mas como é um clique do usuário, isso também desbloqueia o autoplay para os próximos toques automáticos.

### Arquivos editados

- `src/hooks/useNotificationSound.ts` — expor uma nova função `testSound()` que sempre toca o áudio (ignora `enabled` e ignora `lastPlayAt`), sem mexer em throttle/estado de toggle.
- `src/components/crm/CRMLayout.tsx` — desestruturar `testSound` do hook e adicionar um `<Button>` ícone com `Volume2` (lucide-react) ao lado do `SoundToggle`, com tooltip "Testar som de notificação". Reutilizar o mesmo botão no `MobileHeader` e `DesktopHeader`.

### Fora do escopo

- Mudar o ícone ou tamanho do toggle existente.
- Configurar volume customizável.
- Persistir histórico de testes.
