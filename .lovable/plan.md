## Som de notificação no chat (CRM)

Hoje **não temos** nenhum som tocando quando chega mensagem nova no CRM — só atualização visual via realtime. Vou adicionar um "ding" suave quando entrar uma mensagem **inbound** (recebida do cliente), com controle do usuário.

### Comportamento

- Toca um som curto (~0.4s) ao chegar mensagem nova com `direction = 'inbound'`.
- **Não toca** para mensagens enviadas pelo próprio operador (outbound).
- **Não toca** se a aba estiver em foco E a conversa do contato já estiver aberta (evita poluição sonora durante atendimento ativo).
- **Throttle** de 2s entre sons (evita rajada quando chegam várias mensagens juntas).
- Pisca o `document.title` ("🔔 Nova mensagem • Uz4Flow") quando a aba está em background, voltando ao normal no foco.
- Respeita preferência do navegador: se o user nunca interagiu com a página, o navegador bloqueia áudio — nesse caso, falha silenciosamente (sem erro).

### Controle do usuário

Toggle "🔔 Som de notificação" no **header do CRM** (ao lado dos filtros existentes), persistido em `localStorage` por usuário (`crm_notification_sound = "1" | "0"`, default `"1"` ligado). Sem necessidade de tabela ou backend.

### Arquivos

**Novos:**
- `public/sounds/notification.mp3` — som curto de notificação (gero um "ding" leve, ~10KB).
- `src/hooks/useNotificationSound.ts` — hook que expõe `playNotification()`, lê toggle do localStorage, controla throttle, gerencia `Audio` reutilizável e título da aba.

**Editados:**
- `src/hooks/useCRMRealtime.ts` — no `handleNewMessage`, ler `payload.new.direction` e `payload.new.from_me`; se for inbound, chamar `playNotification()` do hook (passado via `options` ou consumido direto).
- `src/pages/CRM.tsx` — adicionar botão toggle 🔔/🔕 no header (próximo aos filtros existentes) usando `Button` ghost size icon, com tooltip "Som de notificação ligado/desligado".

### Detalhes técnicos

- `Audio` instanciado uma única vez via `useRef`, com `.preload = "auto"` e `volume = 0.5`.
- Throttle implementado com `useRef<number>` guardando timestamp do último play.
- Detecção de aba em foco: `document.visibilityState === "visible"` + `document.hasFocus()`.
- Título: salvar título original ao montar, restaurar no `visibilitychange` quando voltar ao foco.
- Filtro inbound: `payload.new.direction === 'inbound'` (já é o campo padrão da tabela `messages`).

### Fora do escopo

- Notificações nativas do navegador (Web Notifications API) — pode ser uma evolução futura com permission prompt.
- Sons diferenciados por tipo de mensagem (áudio/imagem/texto).
- Configuração de som customizado pelo usuário.
- Mudanças no Instagram/voice — apenas CRM de chat.
