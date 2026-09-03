# Botão de tema claro/escuro no formulário público

## Situação atual (verificada)

Em `src/pages/PublicForm.tsx` o tema só é definido pelo parâmetro de URL `?tema=light|dark`
(efeito nas linhas 88-134). Não existe nenhum botão de alternância na tela — por isso o
formulário público abre sempre no tema definido pela URL (padrão escuro) e o visitante não
consegue trocar.

## O que será feito

1. Criar um estado local `formTheme` em `PublicForm.tsx`, inicializado a partir de
   `?tema=` (padrão `dark`).
2. O efeito de tema passa a aplicar `formTheme` em `document.documentElement` em vez de ler
   o parâmetro diretamente; o cleanup existente (restaurar o tema salvo ao sair) continua igual.
3. Adicionar um botão de alternância (ícones Sol/Lua do lucide-react) na barra fixa do topo
   do formulário (linha 1102), à direita do indicador "Passo X de Y", usando tokens do design
   system (sem cores fixas), com `aria-label` acessível.
4. O botão também aparece na tela de "formulário não encontrado"? Não — apenas no formulário
   ativo, para manter o escopo mínimo.

## Fora de escopo

- Nenhuma mudança em banco, RLS ou edge functions.
- `?cor=` (cor de destaque) continua funcionando como hoje.

## Arquivos

- `src/pages/PublicForm.tsx`

## Validação

- Abrir `/f/<token>`: botão visível no topo; clicar alterna claro/escuro imediatamente.
- `/f/<token>?tema=light` abre em claro e o botão continua alternando.
- Ao sair da rota, o tema do painel é restaurado.
