# Auditoria E2E — Avaliação Automática por IA

## Escopo analisado
- **Backend cron**: `supabase/functions/process-conversation-evaluations/index.ts` (865 linhas)
- **Frontend config**: `src/components/crm/settings/ConversationEvalConfigCard.tsx` (1101 linhas)
- **Frontend logs**: `src/components/crm/settings/EvaluationLogsCard.tsx`
- **Frontend card por conversa**: `src/components/crm/ConversationEvalCard.tsx`
- **Tabela**: `conversation_evaluations` + UNIQUE INDEX `(conversation_id, last_message_at_snapshot)`
- **Estado real do banco**: 0 duplicatas nos últimos 7 dias (correção anterior surtiu efeito)

---

## 1. BACKEND — bugs confirmados

### 1.1 Limite global de 10 convs por run penaliza tenants grandes (CRÍTICO)
`MAX_CONVERSATIONS_PER_RUN=10` é compartilhado entre TODOS os tenants. Iteração `for (const [orgId, orgConfigs] of configsByOrg)` consome o budget na ordem do `Map`. Org grande no início "rouba" tudo; orgs no fim podem ficar dias sem processamento.
**Fix**: trocar para budget POR ORGANIZAÇÃO (10/org/run) ou usar fairness round-robin.

### 1.2 Query `conversations` sem `ORDER BY` (NÃO-DETERMINÍSTICO)
Linhas 328–344: a lista de conversas a processar não tem ordenação. Postgres retorna em ordem arbitrária — algumas conversas podem ser processadas centenas de vezes enquanto outras nunca sobem.
**Fix**: `.order('last_message_at', { ascending: false })`.

### 1.3 Filtro de "conversa elegível" inexistente (DESPERDÍCIO DE AI)
A query busca TODAS as conversas com `last_message_at IS NOT NULL`, sem filtrar por `last_message_at >= silenceThreshold` ou por "tem mensagem inbound recente". Para cada conversa, faz round-trip extra ao DB (`lastCustomerMsg`) e depois descarta. Em tenants com 5000+ conversas, isso explode I/O.
**Fix**: pré-filtrar `last_message_at <= silenceThreshold AND last_message_at >= now() - 24h` direto na query.

### 1.4 Conversas com `instance_id NULL` ficam no escopo do config global mesmo quando há config por instância (PARCIAL)
Linhas 367–372: a guarda só pula conversas cujo `instance_id` bate com algum config de instância. Se o tenant tem config global + config por instância e a conversa tem `instance_id` diferente das configuradas, ela ainda cai no global. Isso pode ser intencional, mas não está documentado e gera confusão "minha config por instância não está sendo usada".
**Fix**: adicionar log explícito da decisão `[eval-cron] route conv=X config=instance|global reason=...`.

### 1.5 Erro de AI gera "snapshot consumido" sem retry (BUG SUTIL)
Linhas 577–593: quando `callAI` falha (rate limit, 5xx), o código insere uma linha com `ai_summary='Erro na análise: 429'` e `last_message_at_snapshot=customerLastTs`. Como o snapshot é igual ao da última mensagem do cliente, o anti-loop NUNCA mais reprocessa essa conversa enquanto o cliente não enviar nova mensagem. Isso "queima" silenciosamente avaliações por falha transitória.
**Fix**: em erro transitório (429/5xx), NÃO inserir linha; logar e continuar.

### 1.6 `update last_evaluated_at` é redundante (CÓDIGO MORTO)
Linhas 658–662 atualizam `conversations.last_evaluated_at` mas o gate de `once_per_day` (linha 437–448) consulta `conversation_evaluations.evaluated_at`. A coluna existe mas não é usada para nada funcional.
**Fix**: remover update OU passar a usar como fast-path.

### 1.7 `silence_minutes` aceita `0` ou negativo
Não há validação. Valor 0 dispara avaliação a CADA mensagem (vira `every_inbound` disfarçado).
**Fix**: validar `silence_minutes >= 1` no frontend e via trigger no banco.

### 1.8 Mirror para "Gestor" cria conversa fantasma na CRM (UX)
Linhas 156–181: ao enviar via WhatsApp para o telefone do gestor, cria contato `Gestor (XXXX)` + conversa + mensagem com `direction='outbound', sender_type='ia'`. Em tenants com 3 telefones de gestor, vira ruído permanente no Inbox CRM. Não causa loop (sem inbound), mas suja a interface.
**Fix**: marcar essas conversas com `metadata.hidden_from_inbox=true` e filtrar do CRM padrão.

---

## 2. FRONTEND — bugs e UX

### 2.1 `EvaluationLogsCard` usa `useUserOrganization` direto (impersonation parcial)
Linha 41: `const { data: org } = useUserOrganization()` — funciona após o fix recente de `useSyncExternalStore`, mas a query não tem `organizationId` na queryKey de re-render reativo durante alternância rápida de impersonation, podendo mostrar logs do tenant anterior por ~1 frame.
**Fix**: forçar `enabled: !!organizationId` (já tem) + `staleTime: 0` quando impersonação muda.

### 2.2 `ConversationEvalCard` sem indicador de "avaliação em andamento"
A card retorna `null` se não houver eval. Operador não sabe se "ainda não avaliou" ou se "está desativado". Para `silence_only` com 60min de silêncio, o usuário vê tela vazia e abre ticket.
**Fix**: mostrar estado `Aguardando silêncio (X min restantes)` quando há config ativa mas sem eval.

### 2.3 Sem realtime — depende de polling (60s/30s)
Cards usam `refetchInterval`. Quando o cron processa, leva até 1 min para o operador ver.
**Fix**: subscribe `postgres_changes` em `conversation_evaluations` filtrado por `conversation_id` (card) e `organization_id` (logs).

### 2.4 `EvaluationLogsCard` fixo em `limit(50)` sem paginação
Tenants ativos perdem histórico antigo sem aviso. Não há contador "X de Y avaliações".
**Fix**: mostrar total + botão "Carregar mais 50".

### 2.5 `ConversationEvalConfigCard` (1101 linhas) — não há badge "frequência efetiva atualmente salva no servidor"
Após salvar, não há feedback explícito de qual valor o servidor recebeu. Usuário com config por instância + config global tem dúvida sobre qual prevalece.
**Fix**: badge `Frequência ativa: <valor>` ao lado do select + aviso "Esta organização também tem config global ativa em modo X" quando aplicável.

### 2.6 `(supabase as any)` em vários `.from("conversation_evaluation_configs")`
Tipos não regenerados — quebra type-safety.
**Fix**: garantir migração tipada e remover `as any`.

### 2.7 Validação de telefones de WhatsApp do gestor não existe
`whatsapp_phones: ["", "", ""]` — usuário pode salvar telefone inválido e nunca receber. Sem feedback.
**Fix**: validar formato `+55 11 91234-5678` (regra global do projeto) antes de salvar.

### 2.8 "Preview quebra sempre" (relatado pelo usuário)
Não há erro óbvio nos componentes. Hipóteses:
- `EvaluationLogsCard` chama `format(new Date(...), ...)` sem guard se `evaluated_at` for inválido — não deve quebrar mas pode warnings.
- O preview da Lovable (não o app) pode quebrar pela URL com payload longo (já investigado em ciclo anterior).
**Fix**: reproduzir com `browser--navigate_to_sandbox /settings` + console logs e capturar stack real antes de patch cego.

---

## 3. SEGURANÇA / RLS

- `conversation_evaluations` tem RLS por `organization_id` ✓ (verificado: `has_role` + `is_admin_master`).
- Edge function valida `CRON_SECRET` ou service-role ✓.
- Falta: rate-limit por org no edge function — qualquer attacker com `CRON_SECRET` vazado pode disparar 1000× e estourar Lovable AI quota.
**Fix**: cap `process_evaluations` por org/min usando tabela `rate_limits`.

---

## 4. PLANO DE CORREÇÃO (ordenado por impacto)

### Fase 1 — Backend (alto impacto)
1. Pré-filtrar `last_message_at` na query principal + adicionar `ORDER BY last_message_at DESC` (1.2 + 1.3).
2. Trocar `MAX_CONVERSATIONS_PER_RUN` para budget por org (`10/org`) (1.1).
3. Não inserir linha em erro transitório de AI; remover snapshot poisoning (1.5).
4. Logar decisão de roteamento config instance vs global (1.4).
5. Trigger validando `silence_minutes >= 1` (1.7).
6. Marcar mirror como `metadata.hidden_from_inbox=true` (1.8).

### Fase 2 — Frontend (UX visível)
7. Badge "Frequência ativa no servidor" + aviso de config global concorrente (2.5).
8. Indicador "Aguardando silêncio" no `ConversationEvalCard` (2.2).
9. Realtime subscribe em `conversation_evaluations` (2.3).
10. Validação de telefone gestor `+55 ...` antes do save (2.7).
11. Paginação em `EvaluationLogsCard` (2.4).

### Fase 3 — Hardening
12. Rate-limit por org no edge function (3).
13. Reproduzir crash de preview ao vivo via `browser--navigate_to_sandbox` antes de qualquer patch (2.8).
14. Remover `(supabase as any)` (2.6).

---

## 5. Verificações já PASSADAS (não há bug)
- ✅ Anti-loop por snapshot funciona (0 duplicatas em 7 dias confirmado no DB)
- ✅ UNIQUE INDEX (`conversation_id, last_message_at_snapshot`) ativo
- ✅ Filtro de mensagens self-generated (`metadata.source === 'conversation_evaluation'`) impede AI analisar próprios resumos
- ✅ Mirror não causa eval recursiva (sem inbound do "Gestor")
- ✅ RLS tenant-isolation correto

---

Aprovar para execução das **Fases 1 + 2** (7 fixes backend + 5 fixes frontend). Fase 3 fica para ciclo seguinte se aprovado.
