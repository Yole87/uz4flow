## Objetivo

Limpar os dados hardcoded ("Ana Carolina Silva", "Bruno Henrique Costa", etc.) que aparecem na página **Fila de Atendimento** (`/queue`) e mostrar apenas atendentes reais cadastrados em **Equipe → Membros**.

## Mudanças

### 1. `src/components/team/QueueTabsView.tsx`
- Remover bloco `MOCK_ENABLED` e o array `mockRows` (linhas ~84–161).
- Trocar `const rows = MOCK_ENABLED ? mockRows : realRows;` por `const rows = realRows;`.
- Sem mock, quando a organização não tem nenhum membro cadastrado, o `EmptyState` "Fila zerada — Nenhum atendente cadastrado ainda" já existente cobre o estado vazio (vou ajustar o texto do CTA para indicar "Cadastre membros em Equipe → Membros").

### 2. `src/components/team/AttendantQueuePanel.tsx`
- Remover arrays `mockNames` / `mockPreviews` e a geração de `mockConversations` (linhas ~86–119).
- Simplificar para usar apenas `realConversations` da query no Supabase.
- Remover a condição `enabled: !row.member_id.startsWith("mock-")` — query passa a rodar sempre que houver `row.member_id`.
- Ajustar `isLoading` para usar diretamente `isLoadingReal`.

### 3. Sem mudanças em backend
A view `attendance_queue_view` já lê de `team_members` filtrando por `organization_id`, então só os membros adicionados no menu **Equipe** vão aparecer automaticamente. Nenhuma migração necessária.

## Resultado esperado

- Página `/queue` mostra apenas atendentes reais da organização do usuário.
- Se nenhum membro foi cadastrado em **Equipe → Membros**, aparece o EmptyState "Fila zerada".
- Cada atendente lista somente conversas reais atribuídas a ele (`contacts.assigned_to_member_id`).
- Os 4 cards de topo (Atendentes online, Conversas ativas, Aguardando, Espera média) passam a refletir números reais (zero quando não houver dados).
