# Corrigir tela branca no Funil Kanban

## Causa
O Kanban quebra com o erro "Cannot read properties of null (reading 'slice')". Para mostrar as iniciais no avatar, o cartão do contato usa o nome ou, se não tiver nome, o telefone. Este cliente tem pelo menos um contato sem nome e sem telefone (provavelmente um lead do Instagram), e isso derruba a página inteira.

## Correção
- No cartão do Kanban, usar como alternativa nome, depois telefone, depois @ do Instagram, e por último "?". Assim o avatar nunca recebe um valor vazio.
- Revisar o mesmo cartão para outros textos que podem chegar vazios (nome exibido, telefone formatado) e usar um texto padrão, como "Sem nome".

## Detalhes técnicos
- `src/components/crm/KanbanCard.tsx` linha 105: `(contact.name || contact.phone || contact.ig_handle || "?").slice(0, 2)`.
- Mudar o tipo `phone` para `string | null` na interface `Contact` de `KanbanBoard.tsx`.
- Validar abrindo /kanban na conta do cliente.
