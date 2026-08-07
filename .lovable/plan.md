# Deploy da Edge Function prospect-webhook

## Objetivo
Deployar a edge function `prospect-webhook` para produção.

## Contexto
- A function `supabase/functions/prospect-webhook/index.ts` já existe e está configurada em `supabase/config.toml` com `verify_jwt = false`.
- A function recebe webhooks de formulários (ex: Elementor), valida um token de query string, extrai campos do payload e grava leads em `prospect_leads`.
- Ela usa `service_role` para bypass de RLS e possui CORS permissivo para webhooks externos.

## Passos
1. Fazer deploy imediato da edge function `prospect-webhook` via `supabase--deploy_edge_functions`.
2. Verificar se o deploy retornou sucesso.
3. Caso o deploy falhe com erro 500 ou lockfile incompatível, remover/renomear `deno.lock` e repetir o deploy (segundo troubleshooting de edge functions).
4. Após deploy com sucesso, confirmar ao usuário que a function está ativa.

## Nota
Edge functions de backend (Lovable Cloud) deployam automaticamente quando alteradas no repositório. Como foi solicitado deploy explícito, este plano executa via ferramenta de deploy imediato.
