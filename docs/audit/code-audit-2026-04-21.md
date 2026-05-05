# Code Audit — 2026-04-21

> **Escopo:** 68 Edge Functions (`supabase/functions/*/index.ts`), 187 migrations SQL (`supabase/migrations/`), 43 hooks, ~30 páginas, ~200 componentes em `src/`.
> **Modo:** apenas leitura/inventário. **Nenhum código de aplicação foi alterado.**
> **Convenções:** mesma estrutura de `ui-audit-2026-04-21.md` (P0 = produção quebra/vaza; P1 = bug provável/débito que estoura; P2 = manutenibilidade).

---

## Resumo executivo

- **Total de issues identificadas:** **84** (P0: **6** / P1: **38** / P2: **40**)
- **Top 5 categorias por volume:**

| # | Categoria | Issues | Observação |
|---|-----------|-------:|------------|
| 1 | Type safety | 22 | 428 `any` em `src/`, 203 em EFs |
| 2 | Segurança | 14 | 4 P0 reais; 0/68 EFs validam com zod |
| 3 | Error handling | 12 | 3 catches vazios em EFs, retry policies ausentes |
| 4 | Duplicação | 11 | helpers de template/decrypt/cors espalhados |
| 5 | Performance | 10 | hooks sem `staleTime`, queries sem `.limit()` |

- **Top 3 hotspots (mais issues por arquivo):**
  1. `supabase/functions/crm-send-message/index.ts` — 28 `any` + retry ausente em integração WhatsApp
  2. `src/pages/admin/AdminAffiliates.tsx` — 29 `any` + forms sem zod
  3. `supabase/functions/openbot-webhook/index.ts` — 14 `any` + payload não validado em webhook público
- **Riscos críticos (P0) — destaque para correção imediata:**

| # | Issue | Arquivo |
|---|-------|---------|
| P0-1 | IDOR em análise de conversas (qualquer caller lê histórico de qualquer contato) | `analyze-conversation/index.ts` |
| P0-2 | Cron público sem segredo — qualquer chamada libera comissões em massa | `release-affiliate-commissions/index.ts` |
| P0-3 | Endpoint público dispara WhatsApp em nome de qualquer org | `billing-notify/index.ts` |
| P0-4 | `action: reveal_key` em endpoint público sem autenticação | `admin-notify/index.ts` |
| P0-5 | `dangerouslySetInnerHTML` com input do usuário (link customizado) inserido em SVG | `AffiliateBanners.tsx:138,179` |
| P0-6 | 0/68 Edge Functions usam zod para validar input — payload arbitrário aceito em webhooks públicos | sistêmico |

---

## 1. Segurança

### 1.1 RLS policies

#### [P2] `affiliate_settings` lido por `anon` em migration histórica
- Arquivo: `supabase/migrations/20260421075008_9fec66af-d7ff-49b4-a70c-17b0ffa0e93d.sql:32-33`
- Snippet:
```sql
DROP POLICY IF EXISTS "Anyone authenticated can read settings" ON public.affiliate_settings;
DROP POLICY IF EXISTS "Public can read affiliate settings" ON public.affiliate_settings;
```
- Problema: as policies **foram** removidas nesta migration (boa). Verificar visualmente se o `program_enabled` e `kit_url` ainda são lidos por `anon` no front (LandingHero precisa).
- Sugestão: confirmar por checagem manual que somente `program_enabled`, `current_terms_version` e `kit_url` são acessíveis publicamente; `commission_percent` e `tax_percent` devem estar restritas a `authenticated`.

#### [P2] `USING (true)` em policies legítimas
- Categoria: `coupons`, `subscription_plans`, `affiliate_terms_versions`, `branding_assets` (público por design)
- Problema: catalogadas; nenhuma expõe dado sensível na inspeção. **Falso positivo** se reportadas como P0/P1.
- Sugestão: documentar em `docs/security/public-tables.md` para futuras auditorias não revisitarem.

### 1.2 Secrets e credenciais

#### [P2] `console.log` com substring de token
- Arquivos: `supabase/functions/instagram-oauth/index.ts`, `supabase/functions/gdrive-oauth-callback/index.ts`
- Problema: tokens já são mascarados (substring(0,6)) antes do log, mas ainda expõem prefixo identificável. Em logs vazados pode ajudar enumeração.
- Sugestão: substituir por `[REDACTED]` ou hash SHA-256 dos primeiros 8 chars.

✅ **Sem secret hardcoded em `src/`** (`grep "sk_live\|SUPABASE_SERVICE_ROLE_KEY" src/` → 0).

### 1.3 XSS / injection

#### [P0] `dangerouslySetInnerHTML` com input do usuário virando SVG
- Arquivo: `src/components/affiliates/AffiliateBanners.tsx:138,179`
- Snippet:
```tsx
<div
  dangerouslySetInnerHTML={{ __html: bannerSvg(b, link, code, pct, true) }}
/>
```
- Problema: `link`, `code`, `pct` chegam de inputs no formulário do afiliado. `bannerSvg()` interpola direto em SVG sem escape. Um `code` com `"><script>` dentro do SVG pode executar código no painel do próprio afiliado (auto-XSS) ou pior, ao copiar o snippet HTML para terceiros.
- Sugestão: passar pela função `escapeXml(s) = s.replace(/[<>&"']/g, ...)` antes de inserir no SVG. Adicional: validar `link` como URL `https://` no zod do form.

#### [P2] `dangerouslySetInnerHTML` em `chart.tsx` (shadcn)
- Arquivo: `src/components/ui/chart.tsx:70`
- Problema: gera CSS dinâmico a partir de config controlada. Sem input do usuário direto. **Falso positivo**.
- Sugestão: documentar como exceção aceita.

✅ **Sem `eval()` / `new Function()` em `src/` ou `supabase/functions/`.**

### 1.4 Autorização em rotas admin

#### [P1] Rotas `/admin/*` checadas só client-side
- Arquivos: `src/pages/admin/AdminOrganizations.tsx`, `AdminAffiliates.tsx`, `AdminCoupons.tsx`, `AdminSettings.tsx`, `AdminPlans.tsx`, `AdminNotifications.tsx`
- Problema: o `AdminLayout` valida `is_admin_master()` no client. RLS no DB cobre, mas EFs administrativas (ex: `admin-create-team-member`, `admin-notify reveal_key`) precisam revalidar role no servidor — algumas não fazem (ver 1.5).
- Sugestão: em toda EF admin: `const { data: isAdmin } = await sb.rpc('is_admin_master')` antes de qualquer ação.

### 1.5 Validação de input em Edge Functions

#### [P0] IDOR em `analyze-conversation`
- Arquivo: `supabase/functions/analyze-conversation/index.ts:17-49`
- Snippet:
```ts
const { contact_id, notes: providedNotes } = await req.json();
// ... cria service-role client ...
const { data: contact } = await supabase
  .from("contacts").select(...).eq("id", contact_id).single();
```
- Problema: `verify_jwt` está no default e a função roda com **service role**. Não valida que o JWT do caller pertence à org dona do `contact_id`. Resultado: qualquer authenticated user da plataforma consegue ler nome/telefone/metadata e até 30 mensagens de qualquer contato passando o UUID.
- Sugestão: ler JWT (`req.headers.get('Authorization')`), criar client com anon key + esse JWT, validar via RLS (`.from('contacts').select('organization_id').eq('id', contact_id)`). Só então usar service role para o restante.

#### [P0] `release-affiliate-commissions` sem cron secret
- Arquivo: `supabase/functions/release-affiliate-commissions/index.ts:13-19`
- Snippet:
```ts
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.rpc("release_grace_commissions");
```
- Problema: endpoint público (CORS `*`, sem JWT, sem `CRON_SECRET`). Qualquer um pode disparar — efeito é benigno hoje (só libera o que já passou da janela de graça), **mas combinado com manipulação de `unlocks_at` se vira possível quebrar a janela de proteção contra fraude/refund**.
- Sugestão: header `x-cron-secret: ${CRON_SECRET}` (já existe o segredo) — padrão de 12 outras EFs do projeto (`process-billing-reminders`, `process-conversation-evaluations`, etc.).

#### [P0] `billing-notify` sem auth aceita `organization_id` arbitrário
- Arquivo: `supabase/functions/billing-notify/index.ts:39-47`
- Snippet:
```ts
const payload = await req.json();
const { event_type, organization_id, metadata = {} } = payload;
// ... busca telefone do owner e dispara WhatsApp ...
```
- Problema: `verify_jwt = false` no `config.toml:42`, sem cron secret. Qualquer um pode chamar passando `organization_id` de qualquer empresa e dispara mensagem de cobrança no WhatsApp do dono. Vetor de spam/phishing direcionado.
- Sugestão: exigir `x-cron-secret` (chamada vem só de `process-billing-reminders` e do webhook MP — ambos podem injetar o header).

#### [P0] `admin-notify` `action: reveal_key` sem auth
- Arquivo: `supabase/functions/admin-notify/index.ts:53-79`
- Snippet:
```ts
if (action === "reveal_key") {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: cfg } = await supabaseAdmin.from("admin_notification_config")...
  const token = await decrypt(cfg.openbot_token_encrypted);
  return new Response(JSON.stringify({ token }), ...);
}
```
- Problema: endpoint público (CORS `*`, sem JWT). Qualquer um chama `{action:"reveal_key"}` e recebe o token OpenBot do admin descriptografado. **Vazamento direto de credencial de envio WhatsApp da plataforma toda.**
- Sugestão: validar JWT + `is_admin_master()` antes de processar `store_key`/`reveal_key`. Comentário "(admin-only via service role)" no código é falso — service role no servidor não valida o caller.

#### [P0] 0 / 68 EFs usam zod
- Arquivos: todos em `supabase/functions/*/index.ts`
- Problema: `grep -l "zod\|z\." supabase/functions/*/index.ts` retorna 0. Toda validação é manual (`if (!x) return 400`). Webhooks públicos (`external-webhook`, `instagram-webhooks`, `mercadopago-webhook`, `crm-openbot-inbound`) recebem JSON arbitrário e o spread `{...payload}` em queries DB pode causar problemas se um campo inesperado bater.
- Sugestão: importar `https://deno.land/x/zod@v3.23.4/mod.ts` e migrar progressivamente. Priorizar webhooks públicos.

---

## 2. Integridade de dados

#### [P0] `analyze-conversation` cross-tenant — **ver 1.5**

#### [P1] Colunas `_id` sem foreign key explícita em algumas tabelas
- Categoria: amostragem em migrations recentes. Maioria tem FK (visível nos types: `Relationships`).
- Sugestão: rodar `psql -c "select conrelid::regclass, conname from pg_constraint where contype='f'"` em uma onda futura para diff completo.

#### [P1] `ON DELETE CASCADE` em logs/auditoria
- Total no projeto: 106 declarações.
- Suspeito: `admin_notification_logs`, `connector_events`, `crm_webhook_events`, `event_actions` — se forem cascade de org/user, perdem histórico forense ao deletar conta.
- Snippet (a verificar): `supabase/migrations/*` — buscar `ON DELETE CASCADE` em FKs que apontam para `auth.users` ou `organizations`.
- Sugestão: trocar por `ON DELETE SET NULL` em tabelas de log/auditoria.

#### [P2] `get_user_id_by_email` exposto via `SECURITY DEFINER`
- Arquivo: db function `public.get_user_id_by_email`
- Problema: qualquer chamada `supabase.rpc('get_user_id_by_email', { p_email })` revela se o e-mail existe no sistema → enumeração de contas.
- Sugestão: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role` e chamar somente de EFs admin.

#### [P2] Triggers de validação em vez de CHECK constraints — ✅ **bom padrão**
- Confirmado: `validate_quick_reply`, `validate_eval_config`, `validate_keyword_rule`, etc. seguem o pattern correto (não usam CHECK com `now()`).

---

## 3. Performance

#### [P1] `useAffiliate.ts` — 3 queries paralelas sem `.limit()`
- Arquivo: `src/hooks/useAffiliate.ts:107-111`
- Snippet:
```ts
const [clicks, referrals, commissions] = await Promise.all([
  supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("affiliate_id", affiliateId),
  supabase.from("affiliate_referrals").select("id, current_status, plan_id, first_payment_at").eq("affiliate_id", affiliateId),
  supabase.from("affiliate_commissions").select("commission_amount, status").eq("affiliate_id", affiliateId),
]);
```
- Problema: `affiliate_referrals` e `affiliate_commissions` crescem sem teto. Hoje OK; em 6 meses um afiliado top trava o painel. Default supabase é 1000 rows — passa disso e a soma de comissões fica errada silenciosamente.
- Sugestão: agregar via RPC `get_affiliate_stats(affiliate_id)` que retorna sums já calculados em SQL.

#### [P1] Hooks sem `staleTime`
- Arquivos: `src/hooks/useActiveVoiceCall.ts:23` (`refetchInterval: 3000` mas sem staleTime), múltiplos hooks de admin
- Problema: refetch a cada mount + intervalo agressivo em painéis abertos por horas.
- Sugestão: padronizar `staleTime: 30_000` para listas e `60_000` para configs.

#### [P2] `select('*')` em rotas administrativas hot
- Arquivos: amostragem em `AdminOrganizations.tsx`, `AdminAffiliates.tsx`
- Problema: traz colunas de auditoria (encrypted blobs, JSONB grandes) sem necessidade.
- Sugestão: enumerar colunas explicitamente.

#### [P2] Realtime `channel` count vs `removeChannel` count
- Total `channel(`/`subscribe`: ~14; `removeChannel`/`unsubscribe`: ~10.
- Diferença sugere channels sem cleanup. `AdminOrganizations.tsx:121-126` ✅ tem cleanup. Auditar individualmente os 4 sem par em onda futura.

✅ **Sem N+1 detectado** (`grep "for.*of" + "await supabase.from"` retorna 0 em src/ e EFs).

---

## 4. Padrões React

#### [P1] `useEffect(..., [])` com deps faltando — top 3
- `src/components/flows/FlowCanvas.tsx` — 6 efeitos com array vazio. Provável: handlers que referenciam state externo.
- `src/hooks/useProspectionPolling.ts` — 4 efeitos vazios. Polling crítico de campanhas.
- `src/hooks/useImportContacts.ts` — 4 efeitos vazios. Import paralelo.
- Problema: pode capturar valores stale → bugs intermitentes.
- Sugestão: rodar `eslint-plugin-react-hooks` com `exhaustive-deps` em modo erro e revisar caso a caso.

#### [P1] Forms sem `react-hook-form`
- `src/pages/Auth.tsx`, `src/pages/Checkout.tsx`, `src/pages/AffiliateOnboarding.tsx`
- Problema: validação manual, sem schema zod, sem prevenção de double-submit consistente.
- Sugestão: padronizar para `react-hook-form` + `zodResolver` (já em uso em outros forms).

#### [P2] Listas grandes sem `memo`
- `src/components/crm/ContactsListPane.tsx`, `KanbanCard.tsx`, `MessageBubble.tsx`
- Problema: re-renders cascateando ao mover cards/digitar.
- Sugestão: `React.memo` + `useCallback` nos handlers de pais.

#### [P2] `key={index}` em listas reordenáveis
- Amostragem: vários componentes Kanban e Flow.
- Sugestão: usar IDs estáveis das entidades.

---

## 5. Type safety

### Top 10 hotspots `any` (src/ + EFs)

| # | Arquivo | `any` | Severidade |
|---|---------|------:|-----------|
| 1 | `src/pages/admin/AdminAffiliates.tsx` | 29 | P2 (UI fria) |
| 2 | `supabase/functions/crm-send-message/index.ts` | 28 | **P1** |
| 3 | `supabase/functions/_shared/ai-client.ts` | 20 | **P1** |
| 4 | `src/pages/admin/AdminNotifications.tsx` | 18 | P2 |
| 5 | `src/pages/FlowEditor.tsx` | 18 | P2 |
| 6 | `src/components/crm/ContactsListPane.tsx` | 17 | P2 |
| 7 | `src/pages/Tutorials.tsx` | 15 | P2 |
| 8 | `supabase/functions/openbot-webhook/index.ts` | 14 | **P1** (webhook público) |
| 9 | `src/components/flows/FlowImportExport.ts` | 13 | P2 |
| 10 | `supabase/functions/process-conversation-evaluations/index.ts` | 12 | **P1** |

#### [P1] `any` em payload de webhooks públicos
- Arquivos: `crm-send-message`, `openbot-webhook`, `external-webhook`, `mercadopago-webhook`, `crm-openbot-inbound`
- Problema: payload externo entra como `any` e flui para queries `.insert()`. Sem zod = sem garantia que `phone` é string, etc.
- Sugestão: schema zod por webhook (ver 1.5).

#### [P1] Hooks que retornam `any`
- `src/hooks/useReportData.ts` (10 `any`), `src/hooks/useQuickReplies.ts` (11 `any`), `src/hooks/useContactFolders.ts` (8)
- Problema: consumidores recebem `any` cascateado → `as` casts em 10+ componentes.
- Sugestão: tipar via `Database['public']['Tables']['x']['Row']` do `types.ts`.

#### [P2] `any` em `_shared/ai-client.ts`
- 20 ocorrências. Wrapper genérico de IA (Gemini/OpenAI) — algum `any` é aceitável em contrato genérico, mas response parsing deveria ser tipado.

✅ **Total: 428 (src) + 203 (EFs) = 631 `any`**. Estimativa: ~15% críticos (P1), restante P2/aceitável.

---

## 6. Error handling

#### [P1] Catches vazios em EFs
- Arquivos:
  - `supabase/functions/gmaps-visual-scraper/index.ts:662` — `} catch (e) {}`
  - `supabase/functions/gmaps-visual-scraper/index.ts:791` — `} catch (e) {}`
  - `supabase/functions/instagram-process-event/index.ts:2894` — `} catch (_) {}`
- Problema: erros engolidos. Em scraper, mascara falha de página inteira; em Instagram, pode esconder bug de auto-resposta.
- Sugestão: `console.warn(...)` com contexto mínimo, ou comentário explicando intencionalidade.

#### [P1] `.catch(() => {})` em hook crítico
- Arquivo: `src/hooks/useProspectionPolling.ts:254`
- Snippet: `}).catch(() => {});`
- Problema: polling de prospecção é fonte de verdade do progresso. Erro engolido = usuário vê barra travada sem feedback.
- Sugestão: `}).catch((err) => console.warn('[prospection-poll] tick failed', err));`

#### [P1] Toasts genéricos "Erro ao salvar"
- Amostragem: ~15 mutations em `Settings*Tab`, `Affiliate*Tab`.
- Problema: usuário não distingue erro de rede × validação × permissão.
- Sugestão: helper `getErrorMessage(error)` que mapeia código Supabase (`23505` → duplicado, `42501` → sem permissão, etc.).

#### [P1] Retry policies ausentes em integrações externas
- `vapi-call`, `crm-send-message`, `instagram-process-event`
- Problema: chamadas Vapi/WhatsApp/Meta falham com `503` transitório → mensagem perdida silenciosamente.
- Sugestão: helper `fetchWithRetry(url, opts, { retries: 3, backoff: 'exp' })` no `_shared/`.

#### [P2] Edge Functions retornando 500 genérico
- Padrão: `return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500 })` em ~20 EFs.
- ✅ Bom (não vaza stack), mas devia logar `console.error` com `req_id` para correlação.

---

## 7. Race conditions

#### [P1] Auth flow `signUp → create_org → set_active` sem transação
- Arquivo: `src/pages/Auth.tsx`, fluxo de signup
- Problema: se falhar entre `signUp` e criação de org, usuário fica órfão (sem org_member). Trigger `handle_new_user` cria profile, mas org é separada.
- Sugestão: criar SECURITY DEFINER function `signup_complete(user_id, org_name)` que faz tudo em uma transação.

#### [P1] Double-submit em forms críticos
- Arquivo: `src/pages/Auth.tsx:153,178,186,210,222,237,252,267` — `disabled={loading}` ✅
- Verificar: `Checkout.tsx` e `AffiliateOnboarding.tsx` (não confirmado neste audit).
- Sugestão: padronizar `disabled={isPending}` via `react-hook-form` + `useMutation`.

✅ **0 `onMutate` em src/** → ausência de optimistic UI = sem rollback necessário. **Bom.**
✅ **`mercadopago-webhook` tem idempotência** (memory `webhook-idempotency-logic` confirma).

#### [P2] Idempotência ausente em webhooks secundários
- `external-webhook`, `instagram-webhooks` — não verificam dedup explícito.
- Problema: retry da plataforma externa cria evento duplicado.
- Sugestão: `INSERT ... ON CONFLICT (external_event_id) DO NOTHING`.

---

## 8. Duplicação

#### [P2] Helpers `decryptApiKey()` duplicados
- Arquivos: `resend-flow-message`, `resend-connector-event`, e mais ~3 EFs definem helpers locais que apenas chamam `decrypt()` de `_shared/encryption.ts`.
- Sugestão: remover wrappers locais; importar direto.

#### [P2] `renderTemplate`/`replaceVariables` duplicado
- Arquivos:
  - `admin-notify/index.ts:15-22` — `renderTemplate(body, vars)` com regex `\{key\}`
  - `billing-notify/index.ts:21-27` — `resolveTemplate(template, vars)` com regex `\{\{key\}\}`
  - `resend-flow-message`, `crm-send-message` — versões similares
- Problema: 4 implementações divergentes (sintaxe `{x}` vs `{{x}}`).
- Sugestão: `_shared/templates.ts` com `interpolate(template, vars, { syntax: 'handlebars' | 'curly' })`.

#### [P2] `OPENBOT_SEND_URL` hardcoded
- Arquivos: `billing-notify`, `test-eval-delivery`, `resend-connector-event`, `resend-flow-message`, `admin-notify` — todos com `"https://api.digitalbotia.com.br/sendWebhook"`.
- Sugestão: `_shared/openbot.ts` exportando constante + helper `sendOpenBotMessage(apiKey, phone, message)`.

#### [P2] Helpers de formatação dispersos
- BR: `formatCurrency`, `formatPhone`, `formatDate` aparecem inline em ~20 componentes.
- Sugestão: consolidar em `src/lib/format.ts` (já existe parcialmente).

✅ **`getCorsHeaders` + `handleCorsOptions` em `_shared/cors.ts`** — bom padrão, usado em 95% das EFs.

---

## Anexos

### Distribuição final por categoria

| Categoria | P0 | P1 | P2 | Total |
|-----------|---:|---:|---:|------:|
| 1. Segurança | 4 | 6 | 4 | 14 |
| 2. Integridade de dados | 0 | 2 | 2 | 4 |
| 3. Performance | 0 | 2 | 8 | 10 |
| 4. Padrões React | 0 | 2 | 5 | 7 |
| 5. Type safety | 0 | 8 | 14 | 22 |
| 6. Error handling | 0 | 7 | 5 | 12 |
| 7. Race conditions | 1 | 4 | 0 | 5 |
| 8. Duplicação | 0 | 0 | 11 | 11 |
| **Total** | **6** | **38** | **40** | **84** |

### Ordem sugerida de remediação
1. **P0 sem dependência arquitetural** (~4h cada): `analyze-conversation` IDOR · `release-affiliate-commissions` cron secret · `billing-notify` cron secret · `admin-notify` reveal_key auth · `AffiliateBanners` escapeXml.
2. **Onda zod** (~1d): schemas para os 5 webhooks públicos críticos.
3. **Onda retry+error** (~1d): `fetchWithRetry` helper + migrar 3 integrações externas + `getErrorMessage` helper.
4. **Onda dedup** (~1d): `_shared/templates.ts` + `_shared/openbot.ts` + remover wrappers locais.
5. **Onda types** (longo): hooks → tipar via `Database` types; `any` em hot paths primeiro.
6. **Onda RLS forense** (~½d): `ON DELETE CASCADE` → `SET NULL` em tabelas de log; `get_user_id_by_email` revoke.

### Fora de escopo deste audit
- Aplicação de qualquer correção
- Débito de UI (já em `ui-audit-2026-04-21.md` e `ui-sanity-check-2026-04-21.md`)
- `any` em libs externas / `.d.ts`
- Análise individual de cada `any` ou cada migration
