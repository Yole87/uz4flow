# Correções: quebra de texto, contador de novos leads e tabela de respostas

Sobre a pergunta: não foi um rollback geral. Foi uma restauração seletiva dos arquivos do módulo de formulários que o sync do GitHub havia sobrescrito. Os três problemas abaixo são pontuais e serão corrigidos sem tocar no que já está funcionando (link público por token/slug, CEP, marca d'água, slug no editor, botão "Conversa").

## Anexo 1 — Texto longo cortado no campo de seleção (formulário público)

Hoje o item da lista e o valor selecionado são renderizados em uma única linha e o menu recorta o que passa da largura.

Correção (somente na tela pública):
- O menu passa a respeitar a largura do campo e da tela (nunca maior que a janela no celular).
- Opções longas quebram em várias linhas, com espaçamento adequado.
- O valor selecionado no campo fechado também quebra em linha, com o campo crescendo em altura conforme o texto.
- Mesma verificação aplicada à "Múltipla escolha" para textos longos.

## Anexo 2 — Contador de novos leads/respostas volta a contar sozinho

Verificado no banco: não há duplicação de registros (leads e respostas são únicos). O problema é de marcação de "visto" no app:
- A data da última visita só é gravada ao abrir a tela de respostas de um formulário específico (ou a tela de leads de uma fonte). Abrir a lista "Base e Formulários" não marca nada, então o selo continua aparecendo indefinidamente.
- Mesmo depois de abrir, o selo do card e o do menu lateral continuam usando a data lida antes da gravação, então só somem depois de recarregar a página.

Correção:
- Ao abrir a lista de formulários/fontes e ao abrir um item, gravar a marcação de visto e atualizar imediatamente os contadores (card, aba e menu lateral) sem recarregar.
- Guardar a marcação como a data da resposta/lead mais recente já exibida, em vez do horário do clique, evitando que itens chegados no mesmo instante fiquem "invisíveis" ou reapareçam.
- Fazer as consultas de contagem lerem a marcação no momento da execução, para não usar valor antigo em cache.

## Anexo 3 — Tabela de respostas: cabeçalho quebrando a UI e URL solta

Correção:
- Cabeçalho das colunas: largura mínima e máxima definidas, com quebra de linha do título em duas linhas em vez de esticar a tabela; o ícone de filtro e a ordenação continuam funcionando.
- Células: limite de largura com corte visual e texto completo no tooltip.
- Campos de upload: quando o valor for uma URL de arquivo, exibir novamente o botão "Ver arquivo" (abre em nova aba) no lugar da URL crua. A mesma regra vale para qualquer valor que seja link.

## Detalhes técnicos

- `src/pages/PublicForm.tsx`: em `select_list`, aplicar no `SelectTrigger` altura automática e quebra do texto do valor (`h-auto min-h-12 py-2 [&>span]:whitespace-normal [&>span]:text-left`), no `SelectContent` `w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]` e no `SelectItem` `whitespace-normal break-words leading-snug pr-2`.
- `src/components/crm/base-formularios/UzFormResponses.tsx`: `TableHead` de campos → `whitespace-normal break-words min-w-[140px] max-w-[220px] align-top`; célula → `max-w-[220px] truncate` com `title`; helper `isFileUrl(value)` renderizando botão/link "Ver arquivo" com `ExternalLink`.
- Contadores: gravar `last_visit_form_<id>` / `last_visit_<id>` também ao montar `UzFormsList` e `SourcesList` (por item visível) e, após gravar, `queryClient.invalidateQueries` de `["uz-form-new-responses-count"]`, `["prospect-new-leads-count"]` e `["prospect-total-new-leads"]`. Remover a leitura de `localStorage` da `queryKey` (passa a ser lida dentro da `queryFn`) em `UzFormsList.tsx`, `SourcesList.tsx` e `AppSidebar.tsx`.
- Sem alterações no banco e sem mexer em `PublicForm` além do bloco de seleção.

## Verificação

- Abrir o formulário público no celular com opções longas e conferir texto completo no menu e no campo selecionado.
- Receber uma resposta nova, ver o selo aparecer, abrir a lista e confirmar que o selo some e não retorna ao navegar.
- Abrir a tabela de respostas com coluna de upload e confirmar cabeçalho estável e botão "Ver arquivo".

## Recursos da lista de respostas solicitados — verificação

Conferi arquivo por arquivo: os recursos citados **já estão presentes** no código atual (não foram perdidos no sync). Nada será reescrito, apenas mantido e validado no build:

- `UzFormResponses.tsx`: seleção em massa com checkbox (linhas ~800-930), barra de ações "Desmarcar todas" / "Exportar selecionadas" / "Excluir selecionadas" com AlertDialog, busca global "Buscar em todos os campos...", ordenação por coluna (ASC/DESC/nenhuma, "Enviado em" via banco e colunas dinâmicas no cliente), popovers de filtro por coluna, selo "Novo" com `seen_form_responses_[formId]`, e botão "Conversa" navegando para `/crm?new_conversation_phone=...`.
- `uzFormService.ts`: `deleteFormResponses(ids)`, `getNewFormResponsesCount(formId, lastVisit)` e `getFormResponses(..., sortOrder?)` já existem.
- `UzFormsList.tsx`: já exibe "X respostas · Y novas" usando `getNewFormResponsesCount` + `last_visit_form_[formId]`.
- `AppSidebar.tsx`: o selo de "Base e Formulários" já soma novas respostas de formulário + novos leads de webhook.

Se algum comportamento acima não estiver aparecendo na sua tela, é efeito do bug do contador (Anexo 2) e/ou de cache do PWA — ambos tratados nesta correção.

## Execução

1. Aplicar as correções dos Anexos 1, 2 e 3 em uma única operação.
2. Rodar o build e corrigir eventuais erros.
3. Listar ao final todos os arquivos modificados.
