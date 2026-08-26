# Correção: tabela de respostas invadindo o menu lateral

## O que está acontecendo

A tabela em si já está correta: ela fica dentro de um container com rolagem horizontal (`overflow-x-auto`). O problema não está na tabela, e sim na página que a contém.

Na página do formulário (`src/pages/UzFormDetail.tsx`) e na de Base e Formulários (`src/pages/BaseFormularios.tsx`), a área de conteúdo é um item flex sem permissão de encolher. Como o conteúdo interno é largo (muitas colunas), a área cresce além da tela e empurra/sobrepõe o menu lateral, em vez de a tabela rolar dentro do próprio espaço.

O layout padrão do app (`AppLayout`) já resolve isso corretamente; essas duas páginas montam o layout à mão e ficaram sem esse ajuste.

## Correção

- `src/pages/UzFormDetail.tsx`: adicionar `min-w-0` e `overflow-hidden` na área de conteúdo (SidebarInset) e `min-w-0 overflow-x-hidden` no `main`.
- `src/pages/BaseFormularios.tsx`: mesmo ajuste, para a lista de respostas/leads aberta por lá.
- Nenhuma mudança na tabela, nos filtros, na ordenação, na seleção em massa ou no botão "Ver arquivo".

## Verificação

- Abrir um formulário com muitas colunas em tela ~1338px: o cabeçalho e as linhas devem parar exatamente na borda do menu lateral e rolar horizontalmente dentro do card.
- Repetir com o menu lateral recolhido e em largura de celular.
