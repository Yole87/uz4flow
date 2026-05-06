## Diagnóstico

Os erros permanecem porque há dois problemas separados no fluxo atual:

1. **CORS da função está bloqueando a URL deste projeto remixado.**
   - A função responde com `Access-Control-Allow-Origin: https://openbot-connector.lovable.app`, enquanto a UI está em `https://id-preview--dbd892a4-184b-42d6-96f4-582bff75db13.lovable.app`.
   - Por isso o navegador mostra `Failed to fetch` e a interface não consegue salvar/testar o token.

2. **A função ainda prioriza `MERCADOPAGO_ACCESS_TOKEN` do ambiente.**
   - Isso conflita com o requisito: as keys devem ser configuradas pela interface do usuário.
   - O banco mostra `mercadopago.access_token_configured = true`, mas não existe `mercadopago_access_token_encrypted`, então o status visual ficou positivo sem token realmente salvo.

## Feature 1 — Liberar CORS para projetos remixados

Atualizar `supabase/functions/_shared/cors.ts` para aceitar:

- URL publicada atual do projeto.
- Preview atual do remix.
- Qualquer preview Lovable deste projeto.
- Origens Lovable seguras usadas em preview/desenvolvimento.

Resultado esperado:

- `save-access-token`, `get-access-token` e `test-connection` deixam de falhar com `Failed to fetch`.
- A UI passa a receber respostas reais da função.

## Feature 2 — Mercado Pago 100% gerenciado pela interface

Refatorar `supabase/functions/mercadopago-subscription/index.ts` para:

- Remover a prioridade de `Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")` no fluxo principal.
- Resolver o Access Token exclusivamente de `saas_settings.key = 'mercadopago_access_token_encrypted'`.
- Manter criptografia AES-256-GCM via helper existente.
- Preservar checagem de `admin_master` para salvar/revelar token.
- Retornar erro amigável quando não houver token salvo pela UI.

Resultado esperado:

- O token digitado na tela de Admin Settings vira a fonte oficial.
- Secrets do Lovable deixam de interferir no Mercado Pago.

## Feature 3 — Corrigir estado inconsistente da UI

Ajustar `src/pages/admin/AdminSettings.tsx` para:

- Não marcar “Access Token configurado” apenas porque o JSON `mercadopago.access_token_configured` está `true`.
- Validar o status real chamando `get-access-token`.
- Só exibir “Access Token configurado” se houver token criptografado recuperável no backend.
- Ao salvar token, atualizar o estado local somente depois de resposta positiva da função.
- Alterar o texto “secret do projeto” para “armazenado criptografado nas configurações do sistema”.
- Melhorar a mensagem quando CORS/rede falhar, apontando para erro de comunicação com a função, não credencial inválida.

Resultado esperado:

- A tela não mostra falso positivo.
- O admin sabe se o token realmente foi salvo.

## Feature 4 — Webhook usando o mesmo token da interface

Atualizar `supabase/functions/mercadopago-webhook/index.ts` para:

- Buscar o Access Token criptografado em `saas_settings` como fonte principal.
- Não depender de `MERCADOPAGO_ACCESS_TOKEN` para consultar detalhes de pagamento/assinatura.
- Manter `MERCADOPAGO_WEBHOOK_SECRET` apenas se já for usado para validação de assinatura, pois ele é um segredo técnico do webhook, não a credencial principal do gateway.

Resultado esperado:

- Pagamentos e notificações IPN usam a mesma credencial configurada na interface.

## Feature 5 — Limpeza de configuração inválida

Criar uma correção de dados idempotente para:

- Ajustar `mercadopago.access_token_configured` para `false` se não existir token criptografado em `mercadopago_access_token_encrypted`.
- Preservar `public_key` já configurada.

Resultado esperado:

- O badge verde só aparece quando há credencial real salva.

## Feature 6 — Validação pós-correção

Depois de implementar:

- Testar a função diretamente com `test-connection` antes de salvar token, esperando erro amigável “token não configurado”.
- Testar CORS simulando origem do preview atual.
- Confirmar no banco que o status não fica positivo sem token criptografado.
- Conferir logs da função para garantir que não há erro interno.

## Arquivos envolvidos

- `supabase/functions/_shared/cors.ts`
- `supabase/functions/mercadopago-subscription/index.ts`
- `supabase/functions/mercadopago-webhook/index.ts`
- `src/pages/admin/AdminSettings.tsx`
- Correção idempotente em `saas_settings`

## Critério de aceite

- Salvar Access Token pela UI não retorna mais `Failed to send a request to the Edge Function`.
- Testar conexão usa o token salvo pela UI.
- A UI não depende de secrets do Lovable para Mercado Pago.
- “Access Token configurado” só aparece quando existe token criptografado salvo.
- Webhook/IPN usa a credencial salva pela UI.