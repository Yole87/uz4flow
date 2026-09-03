# Meta Pixel e Google Ads bloqueados pela CSP no formulário público

## Diagnóstico (confirmado no navegador)

O `useEffect` do Meta Pixel em `PublicForm.tsx` está correto (linhas 173–197, antes dos
returns antecipados) e `window.fbq` é criado. Porém a CSP do `index.html` (linha 16) recusa
os scripts externos:

- `script-src` não inclui `https://connect.facebook.net` → fbevents.js bloqueado.
- `script-src` não inclui `https://www.googletagmanager.com` → gtag.js bloqueado.
- Mesmo com os scripts carregando, os eventos seriam bloqueados: o Pixel envia via
  `https://www.facebook.com/tr` e o gtag via `https://www.google-analytics.com/g/collect`
  e `https://googleads.g.doubleclick.net`, ausentes de `connect-src`.

## Correção

Editar apenas a `<meta http-equiv="Content-Security-Policy">` em `index.html`:

1. `script-src`: adicionar `https://connect.facebook.net` e `https://www.googletagmanager.com`.
2. `connect-src`: adicionar `https://www.facebook.com`, `https://www.google-analytics.com`,
   `https://*.analytics.google.com`, `https://googleads.g.doubleclick.net`,
   `https://www.googleadservices.com`.
3. `img-src` já tem `https:` (pixel de imagem de fallback do Meta funciona).

Nenhuma outra mudança em `PublicForm.tsx` ou em edge functions — o código de injeção já está
correto.

## Validação

- Abrir a URL pública do formulário no navegador e confirmar:
  - Sem erros de CSP no console.
  - Meta Pixel Helper detecta o Pixel `674672651891773` com evento `PageView`.
  - `https://www.googletagmanager.com/gtag/js` carrega com status 200.
