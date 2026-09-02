# Formulário público em branco — diagnóstico e correção

## Erro real do console (capturado no navegador)

```text
pageerror: Rendered more hooks than during the previous render.
The above error occurred in the <PublicForm> component
    at PublicForm (src/pages/PublicForm.tsx:65:23)
```

Não é `normalizeOptions`. As chamadas em `PublicForm.tsx` (linhas 544, 731, 780) já usam
`normalizeOptions(field.options || [])`, e `uzFormService.ts` já usa
`Array.isArray(f.options) ? f.options : []`. Nenhum erro de `null` aparece no console.

## Causa confirmada

`PublicForm.tsx` quebra a Regra dos Hooks:

- Retornos antecipados nas linhas 160 (`if (loading)`) e 168 (`if (!form ...)`).
- Dois `useEffect` declarados **depois** desses returns: Meta Pixel (linha 234) e
  Google Ads (linha 262).

No primeiro render (`loading = true`) o componente executa menos hooks; quando o
formulário carrega, os dois efeitos passam a ser chamados e o React aborta a árvore
inteira — tela branca. O comentário na linha 232 diz que os efeitos são incondicionais,
mas eles estão posicionados abaixo dos returns.

## Correção

Em `src/pages/PublicForm.tsx`:

1. Mover os dois `useEffect` (Meta Pixel e Google Ads) para junto dos demais hooks, antes
   do `if (loading)`.
2. Como eles dependem de `form.settings`, ler os IDs diretamente do estado dentro do
   efeito (ex.: `const settings = (form?.settings ?? {}) as Record<string, string>;`
   calculado antes dos returns), mantendo as dependências `[metaPixelId]` e
   `[gtagConversionId]` — quando `form` ainda é `null`, o efeito simplesmente retorna cedo.
3. Manter o restante da lógica de derivação de settings onde está.

Sem mudanças em `uzFormService.ts` (os guards já existem), sem mudanças no banco, RLS ou
edge functions.

## Validação

- Recarregar `/f/<token>` no navegador e confirmar renderização do passo 1 sem erros no
  console.
- Testar um formulário com branching condicional (múltipla escolha) avançando entre passos.
