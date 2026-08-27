# Correção do botão "Conversa" (Via Cadastros e Via Uz4Forms)

## O que está quebrado hoje (verificado no código)

Existem três caminhos diferentes e incompatíveis para a mesma ação:

- `UzFormResponses.tsx` (Via Uz4Forms) navega para `/crm?new_conversation_phone=<tel>`. **Ninguém no CRM lê esse parâmetro** — o CRM abre normalmente e nada acontece.
- `LeadsTable.tsx` (Via Cadastros) navega com `state: { openNewConversation: true, phone }`. O `ContactsPane` até lê esse state, mas o `CRMLayout` chama `setSearchParams(..., { replace: true })` logo na montagem, o que substitui a entrada de histórico e descarta o `location.state` antes/junto da leitura — por isso o diálogo não abre de forma confiável.
- `ContactsPane.tsx` só reconhece o parâmetro legado `new_chat`, que nenhuma das duas telas usa.

Além disso, nenhum dos dois caminhos faz a busca do contato pelo telefone: hoje só o `LeadsTable` abre o chat existente, e apenas quando o lead já tem `crm_contact_id` gravado. Respostas de formulário nunca têm esse campo.

## Correção proposta

Padronizar tudo em um único parâmetro de URL: `/crm?new_conversation_phone=<somente_dígitos>`.

1. **CRMLayout** passa a tratar esse parâmetro:
   - normaliza o telefone (só dígitos);
   - consulta `contacts` da organização por telefone (comparando também variações com/sem o 9º dígito);
   - se encontrar contato: seleciona o contato/conversa e abre o chat (em mobile, muda para o painel de chat);
   - se não encontrar: sinaliza para o `ContactsPane` abrir o diálogo "Nova Conversa" com o telefone preenchido;
   - limpa o parâmetro da URL depois de tratar, sem apagar os demais parâmetros.

2. **ContactsPane** deixa de depender de `location.state` e do parâmetro legado `new_chat`; passa a receber o telefone pré-preenchido via prop vinda do `CRMLayout` e abre o `NewConversationDialog` já preenchido.

3. **LeadsTable** (Via Cadastros): o botão passa a usar o mesmo destino. Se o lead já tiver `crm_contact_id`, continua indo direto para `/crm?contact=<id>`; caso contrário vai para `/crm?new_conversation_phone=<tel>`.

4. **UzFormResponses** (Via Uz4Forms): mantém o destino, apenas garantindo que o telefone seja enviado somente com dígitos (via `stripPhone`).

## Detalhes técnicos

- Arquivos alterados: `src/components/crm/CRMLayout.tsx`, `src/components/crm/ContactsPane.tsx`, `src/components/crm/base-formularios/LeadsTable.tsx`, `src/components/crm/base-formularios/UzFormResponses.tsx`.
- A busca de contato usa o cliente Supabase já existente, filtrando por `organization_id` e `phone` (`in` com as variantes do número), e busca a conversa mais recente do contato para abrir direto no chat.
- Nenhuma alteração de banco, RLS ou edge function é necessária.
- Validação: `npm run build` e teste via navegador nos dois fluxos (contato existente e inexistente).
