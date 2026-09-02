# Branching só em select_list + correção do tema por URL

## Diagnóstico confirmado

1. **Editor (`UzFormEditor.tsx:810`)**: o seletor de `next_step_id` por opção renderiza
   para qualquer campo com opções (`hasOptions`), incluindo `multiple_choice`.
2. **Público (`PublicForm.tsx`, `handleNext` linhas 541-545)**: o branching é verificado
   para `multiple_choice` e `select_list`. Como múltipla escolha agora grava valores
   separados por vírgula, o match `selectedValue.includes(o.label)` pode disparar um salto
   indevido.
3. **Tema por URL**: o `useEffect` de tema em `PublicForm.tsx` (linhas 88-134) já está
   ANTES dos returns antecipados e o cleanup está correto — nada a mover lá. A causa real
   é o `ThemeProvider` (`src/contexts/ThemeContext.tsx`), montado em `App.tsx:247` acima de
   todas as rotas: no mount, efeitos do filho (`PublicForm`) rodam antes do efeito do pai
   (`ThemeProvider`), que então reaplica o tema do `localStorage` por cima do `?tema=light`.

## O que será feito

### 1. Editor — esconder "Ir para o passo" em multiple_choice
Em `src/components/crm/base-formularios/UzFormEditor.tsx` (linha 810):
- Trocar a condição `{steps && steps.length > 1 && (` por
  `{steps && steps.length > 1 && field.field_type === "select_list" && (`.

### 2. Público — branching apenas em select_list
Em `src/pages/PublicForm.tsx` (`handleNext`):
- No loop de campos, pular qualquer campo cujo `field_type !== "select_list"`.
- Com isso o match volta a ser exato (`o.label === selectedValue`), pois select_list é
  single-select.

### 3. Tema — impedir que o ThemeProvider sobrescreva o parâmetro da URL
Em `src/contexts/ThemeContext.tsx`:
- No `useEffect` que aplica o tema, ignorar rotas públicas de formulário
  (`window.location.pathname.startsWith("/f/")`) — nessas rotas o tema é controlado pelo
  `PublicForm` via `?tema=` / `?cor=`.
- O cleanup existente do `PublicForm` (linhas 125-133) já restaura o tema salvo ao sair,
  então nenhum outro ajuste é necessário.

## Fora de escopo
- Sem mudanças no banco, RLS ou edge functions.
- `select_list` continua single-select; `multiple_choice` continua gravando "A, B".

## Arquivos
- `src/components/crm/base-formularios/UzFormEditor.tsx`
- `src/pages/PublicForm.tsx`
- `src/contexts/ThemeContext.tsx`

## Validação
- Build (`npm run build`).
- Editor: campo multiple_choice não mostra "Ir para o passo"; select_list mostra.
- Público: múltipla escolha avança normalmente; select_list com next_step_id salta.
- `/f/<token>?tema=light` abre em claro mesmo com tema salvo dark; ao sair, o tema salvo
  é restaurado.
- Commit local (sem push) ao final.
