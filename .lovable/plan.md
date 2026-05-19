## Diagnóstico

O ajuste recente do som de notificação adicionou um segundo `useCRMRealtime(null)` no nível do `CRMLayout` (linha 48), além do já existente em `ChatPane.tsx` (linha 348). Os dois hooks abrem assinaturas Realtime com o **mesmo nome de canal** (`crm-org-${organization.id}`) no mesmo cliente Supabase.

Efeitos colaterais observáveis disso (compatíveis com "CRM não abre em algumas contas"):

1. **Colisão de canal Realtime** — Supabase realtime-js não suporta dois `channel(name)` idênticos no mesmo client. O segundo subscribe frequentemente cai em `CHANNEL_ERROR` / `TIMED_OUT`. Quando um dos hooks desmonta e chama `removeChannel`, o outro fica órfão e pode disparar reconexões em loop, gerando re-renderizações em cascata via invalidações de query (`crm-messages`, `crm-conversations`, `kanban-contacts`, `pipeline-contacts-count`, `crm-contacts`, `crm-contact`, `crm-contact-details`). Em contas com muitos contatos/conversas, esse loop trava a renderização inicial.

2. **Contas sem permissão em `contacts` INSERT no publication** — o novo filtro `INSERT` em `contacts` foi adicionado para tocar som ao chegar lead. Se a tabela `contacts` não está na `supabase_realtime` publication para INSERT, o subscribe falha. Combinado com (1), amplifica o loop de reconexão.

3. **Falta de error boundary** — se `useQuery` de `instances_safe` ou `useActiveConversations` lança (RLS, view ausente em algum tenant), o `<main>` renderiza vazio sem fallback visual, dando aparência de "CRM não abre".

4. **Loop de invalidação no Kanban/Dashboard** — o `handleContactUpdate` invalida `kanban-contacts` e `pipeline-contacts-count` a cada UPDATE em `contacts`. Em orgs com volume alto de mudanças (mirroring Instagram + WhatsApp), isso pode congelar a aba enquanto o React Query refaz fetch.

## Passos de investigação (antes de aplicar a correção)

1. Abrir DevTools em uma conta afetada e confirmar nos logs:
   - `[CRM Realtime] Subscription status: CHANNEL_ERROR` ou `TIMED_OUT`
   - mensagens repetidas de `Subscribing` / `Unsubscribing` em rajada
2. Rodar `select schemaname, tablename from pg_publication_tables where pubname='supabase_realtime'` para confirmar se `contacts` está incluso com INSERT.
3. Verificar nos `function_edge_logs` se a conta afetada tem erro em `instances_safe` (RLS).

## Plano de correção

### 1. Centralizar o Realtime em um único ponto
- Remover `useCRMRealtime(contactId)` de `ChatPane.tsx`.
- Manter apenas o `useCRMRealtime(null)` em `CRMLayout.tsx` (já cobre mensagens, conversas e contatos para toda a org, e o `ChatPane` já invalida `crm-messages` via invalidação geral).
- Resultado: um único canal por org, sem colisão, sem loop de reconexão.

### 2. Tornar o nome do canal único por escopo (defesa em profundidade)
- Mudar nome para `crm-org-${orgId}-${scope}` caso futuramente haja mais de um hook. Por ora, único hook = único canal.

### 3. Tolerância a falha do filtro `contacts` INSERT
- Separar o subscribe de `contacts INSERT` em um `.on()` próprio com try/catch e log. Se a tabela não estiver na publication para aquela conta, o restante do canal continua funcionando.
- Adicionar verificação/migration garantindo `ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts` (idempotente).

### 4. Fallback visual e error boundary no CRM
- Adicionar `ErrorBoundary` em volta do `<main>` do `CRMLayout` com mensagem amigável "Não foi possível carregar o CRM. Recarregue a página."
- Tratar `error` do `useQuery` de `instances_safe` exibindo estado de erro em vez de tela vazia.

### 5. Reduzir invalidações desnecessárias
- Em `handleContactUpdate`, invalidar `kanban-contacts` / `pipeline-contacts-count` apenas se `payload.new.pipeline_stage_id` mudou (comparar com `payload.old`). Reduz pressão em orgs com muitas updates.

### 6. Validação
- Testar em conta afetada: CRM abre, som toca em nova mensagem inbound e em novo lead, sem `CHANNEL_ERROR` no console.
- Confirmar que Kanban e Dashboard continuam atualizando ao mover contato de estágio.

## Detalhes técnicos

- **Arquivos a editar:**
  - `src/components/crm/ChatPane.tsx` — remover `useCRMRealtime(contactId)` (linha 348).
  - `src/hooks/useCRMRealtime.ts` — ajustar invalidação condicional do contato (comparar `old` vs `new` para pipeline_stage_id).
  - `src/components/crm/CRMLayout.tsx` — envolver `<main>` em ErrorBoundary; exibir erro do `instances` query.
  - `src/components/ErrorBoundary.tsx` (criar se não existir).
- **Migration (idempotente):** garantir `contacts` na publication realtime.
- **Sem mudança de UI** além do estado de erro.
