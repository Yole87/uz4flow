# Diagnóstico: Google Calendar conecta mas mostra "Desconectado"

## Resultado da investigação

O fluxo OAuth está **100% funcional**. O problema é apenas de **leitura do status no frontend**, bloqueada por uma regra de segurança do banco.

### 1. Redirect URI — OK
`google-calendar-oauth` gera e `gdrive-oauth-callback` usa exatamente o mesmo valor:
`https://<projeto>.supabase.co/functions/v1/gdrive-oauth-callback`
O Google aceitou (não houve `redirect_uri_mismatch` nos logs).

### 2. State com organization_id — OK
Log do callback: `state_len=184`, decodificado contém
`{"o":"cb045d9e-…","p":"google_calendar","r":"https://www.uz4flow.com.br/agenda","t":"gcal_…"}`.

### 3. Troca do code pelo token com credenciais do tenant — OK
`[GCal-OAuth] source=tenant client_id_prefix=345746369788-j9tqd30`
`[GDrive-OAuth] step=token_exchange_success has_refresh=true duration_ms=636`

### 4. Gravação em mcp_connections — OK
`[GDrive-OAuth] step=connection_saved action=updated id=7046c3ae-…`
A linha existe no banco: provider `google_calendar`, `is_active = true`, access_token e refresh_token presentes, expiração válida.

## Causa raiz confirmada

O hook `useGoogleCalendar` lê o status pela view `mcp_connections_safe`, que está marcada como `security_invoker = true` — ou seja, herda as regras da tabela `mcp_connections`.

Nessa tabela existe a política **"Deny direct SELECT on mcp_connections"** com condição `false` para usuários autenticados (criada na rodada de endurecimento de segurança). Ela bloqueia qualquer leitura, inclusive através da view. Resultado: a consulta retorna vazio e a tela sempre mostra "Desconectado".

## Correção proposta

1. Migration no banco:
   - Recriar `public.mcp_connections_safe` **sem** `security_invoker` (executa com privilégios do dono, contornando o deny), mantendo apenas as colunas não sensíveis já expostas (id, organization_id, provider, description, is_active, created_at, updated_at) e adicionando um filtro interno `WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))`.
   - Manter `GRANT SELECT` apenas para `authenticated` (remover do `anon`).
   - A política de deny na tabela base permanece intacta: tokens continuam inacessíveis pelo cliente.

2. Nenhuma mudança nas Edge Functions — elas usam service role e já funcionam.

3. Opcional (UX): em `/agenda`, ao detectar `?oauth_status=success` na URL, invalidar a query `google-calendar-connection` e limpar o parâmetro, para o status atualizar na hora sem refresh manual.

## Verificação após aplicar
- Consultar a view como usuário autenticado e confirmar que retorna a linha `google_calendar` com `is_active = true`.
- Abrir `/agenda` e confirmar o status "Conectado".
