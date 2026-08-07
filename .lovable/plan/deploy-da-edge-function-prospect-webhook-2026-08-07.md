# Deploy da Edge Function prospect-webhook

## Objetivo
Redeployar a edge function `prospect-webhook` para garantir que a versão atual do código esteja ativa.

## Contexto
- A function `supabase/functions/prospect-webhook/index.ts` existe e está configurada em `supabase/config.toml` com `verify_jwt = false`.
- Ela recebe webhooks de formulários (ex: Elementor), valida um token de query string, extrai campos do payload e grava leads em `prospect_leads`.
- A function já foi deployada anteriormente, mas foi solicitado um deploy explícito novamente.

## Passos
1. Executar deploy imediato da edge function `prospect-webhook` via `supabase--deploy_edge_functions`.
2. Verificar se o deploy retornou sucesso.
3. Caso o deploy falhe com erro 500 ou lockfile incompatível, remover/renomear `deno.lock` e repetir o deploy.
4. Após deploy com sucesso, confirmar ao usuário que a function está ativa.

## Nota
Edge functions de backend (Lovable Cloud) deployam automaticamente quando alteradas no repositório. Este deploy manual garante a versão atual do código esteja no ar, independente de mudanças recentes.
