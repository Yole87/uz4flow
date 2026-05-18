# Correção do som de notificação do CRM

## Diagnóstico

O som hoje **não toca de forma confiável** por dois motivos no código:

1. **O gatilho do som vive dentro do `ChatPane`** (`useCRMRealtime` é chamado apenas em `src/components/crm/ChatPane.tsx:348`). Isso significa que o som só dispara se uma conversa já estiver aberta. Quando o atendente está na aba **Contatos**, sem conversa selecionada, ou em outra área do CRM, nenhum evento de mensagem nova chega ao hook → **nenhum som toca**.
2. **Sem filtro de direção**: em `useCRMRealtime.handleNewMessage` o `playNotification()` é chamado para qualquer INSERT em `messages`, inclusive mensagens **enviadas pelo próprio atendente** (`from_me = true` / `direction = 'outbound'`). Isso gera disparos errados e mascara o problema de "não tocar quando deveria".

Além disso, o usuário pediu que toque também quando **um novo contato/lead chega** — hoje o INSERT em `contacts` invalida queries mas não dispara `playNotification()`.

## Mudanças

### 1. `src/hooks/useCRMRealtime.ts`
- Em `handleNewMessage`, só chamar `playNotification()` quando a mensagem for **inbound** (`payload.new.direction === 'inbound'` ou `from_me === false`). Mensagens enviadas pelo atendente não tocam som.
- Em `handleContactUpdate` (que já trata INSERT de `contacts`), separar o caminho de INSERT e disparar `playNotification()` quando um **novo contato/lead** é criado na organização.

### 2. Elevar a assinatura realtime para o nível do CRM
- Hoje `useCRMRealtime(contactId)` só é montado em `ChatPane`. Vamos mantê-lo lá (para os callbacks específicos do chat aberto), **mas também montar uma instância no `CRMLayout`** (`src/components/crm/CRMLayout.tsx`) passando `contactId = null`. Assim o canal por organização fica ativo durante toda a sessão no CRM, garantindo que o som toque mesmo:
  - na aba **Contatos**,
  - sem conversa selecionada,
  - ou com a aba do navegador em segundo plano (combinado com o title flash já existente).
- O Supabase Realtime já agrupa múltiplas inscrições no mesmo canal — manter duas chamadas do hook é seguro; cada uma cria seu próprio channel, mas o custo é desprezível e o desacoplamento simplifica a correção sem refatorar o `ChatPane`.

### 3. Garantir que o áudio possa tocar
- O `useNotificationSound` já desbloqueia o autoplay ao **ativar o sino** e ao usar o **botão Testar**. Sem mudanças aqui — apenas garantir na UI/tooltip que o usuário precisa ter clicado pelo menos uma vez no sino/teste para liberar o áudio (já existe).

## Detalhes técnicos

```ts
// useCRMRealtime.ts — handleNewMessage
const msg = payload.new ?? {};
const isInbound = msg.direction === 'inbound' || msg.from_me === false;
if (isInbound) playNotification();
```

```ts
// useCRMRealtime.ts — novo handler para INSERT em contacts
const handleContactInsert = useCallback((payload) => {
  playNotification();          // novo lead chegando
  handleContactUpdate(payload); // mantém invalidação de queries
}, [playNotification, handleContactUpdate]);
```

```tsx
// CRMLayout.tsx — assinatura global do CRM
useCRMRealtime(null);
```

## Fora de escopo (não muda agora)
- Indicador visual piscando no item de origem do lead (linha do contato/conversa).
- Preview ao vivo.
- Qualquer mudança no `ChatPane` além do que já é feito pelo hook.
