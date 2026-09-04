# Diagnóstico: e-mail da conta Google não aparece (fallback "Conta conectada")

## Causa raiz confirmada (3 verificações)

1. **A função está deployada e sendo chamada** — `supabase/functions/google-calendar-account/index.ts` existe e os logs mostram execuções reais. Não é problema de deploy nem de frontend.

2. **O erro real está nos logs da Edge Function:**
   ```
   [GCal-Account] userinfo failed: 401 UNAUTHENTICATED
   Request is missing required authentication credential.
   ```

3. **Origem:** `google-calendar-oauth` gera a URL de autorização pedindo apenas o escopo
   `https://www.googleapis.com/auth/calendar.events` (linha 104). Sem os escopos de identidade
   (`openid`, `userinfo.email`), a API `oauth2/v2/userinfo` recusa a chamada — por isso a função
   retorna `{ error }` e o hook devolve `null`, caindo no fallback "Conta conectada".

## Trechos atuais (conforme pedido)

**useGoogleCalendar.ts (126–141):** a query `google-calendar-account` é chamada com
`enabled: !!org?.id && !!isConnected`; em erro loga no console e retorna `null` → `accountEmail = null`.

**GoogleCalendarSettings.tsx (265–284):** o e-mail é renderizado somente quando `isConnected` é true,
com fallback "Conta conectada" quando `accountEmail` é null — o JSX está correto; o dado que falta.

## Correções propostas

### 1. Escopos de identidade no OAuth (causa raiz)
`supabase/functions/google-calendar-oauth/index.ts`: ampliar o escopo para
`openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar.events`.
Consequência: quem já conectou precisa **reconectar** a conta (novo consentimento) — o Google
emite novo token com os escopos extras. A UI já tem botão Desconectar/Conectar.

### 2. Resiliência no `google-calendar-account`
- Se `userinfo` responder 401, forçar refresh do token (mesmo sem `token_expiry` vencido) e tentar 1 vez de novo antes de desistir.
- Fallback adicional sem escopo novo: tentar `GET https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1` (funciona com escopo calendar) e extrair o `id` do calendário primário — que normalmente é o próprio e-mail da conta. Assim o e-mail aparece mesmo antes de o tenant reconectar.

### 3. Deploy
Deploy das funções `google-calendar-oauth` e `google-calendar-account` ao final.

## Observação
Frontend (`useGoogleCalendar.ts` / `GoogleCalendarSettings.tsx`) **não precisa de alteração** — assim que a função passar a retornar o e-mail, a UI exibe automaticamente.
