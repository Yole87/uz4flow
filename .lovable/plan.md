## Problema

A função `openbot-webhook` (que dispara as respostas dos fluxos) consulta `public.integrations` por `user_id` e retorna 404 quando não existe linha. O cliente **awureartes@gmail.com** tem instância CRM conectada (`instances` ok), mas nenhuma linha em `integrations` — por isso o inbound aparece no CRM mas nenhum fluxo responde.

Hoje a tabela `integrations` só é populada quando o usuário entra em "Configurações → OpenBot" e salva manualmente. Todo cliente novo cai no mesmo bug.

## Solução

Garantir que `integrations` exista automaticamente, copiando os dados que já temos em `instances`.

### 1) Migração — trigger de auto-criação

Criar trigger `AFTER INSERT OR UPDATE OF openbot_api_key_encrypted ON public.instances` que faz `INSERT … ON CONFLICT (user_id) DO UPDATE` em `public.integrations`:

- `user_id` = owner da `organization_id` da instância (via `organizations.owner_user_id`)
- `openbot_api_key_encrypted` = copia do `instances.openbot_api_key_encrypted`
- `openbot_api_key_masked` = mantém o existente (não sobrescreve se já houver)
- `webhook_secret` = gera com `encode(gen_random_bytes(24), 'hex')` apenas se ainda não existir
- `openbot_inbound_url` = mantém o que já estiver salvo

Função `SECURITY DEFINER`, `search_path=public`. Sem mexer em RLS (já existe).

### 2) Backfill único

Mesmo migration: `INSERT … SELECT` em `integrations` para todos os owners de orgs que têm pelo menos uma `instances.openbot_api_key_encrypted` preenchida e ainda não têm linha em `integrations`. Resolve o awureartes e qualquer outro cliente na mesma situação.

### 3) Sem mudanças de frontend

A tela "Configurações → OpenBot" (`useOpenBotConfig`) continua igual — ela já faz upsert, então só preenche/edita o que o trigger criou. URL do webhook continua sendo copiada da mesma tela.

## Limitação que permanece (não é bug)

O cliente ainda precisa **uma vez** colar a URL `…/openbot-webhook?user_id=<uid>&secret=<secret>` dentro do painel do OpenBot. Isso é feito **pelo OpenBot externo**, fora do nosso controle. O que mudamos é que a URL já estará pronta na tela de Configurações desde o primeiro login.

## Validação

1. `SELECT count(*) FROM integrations WHERE user_id='4d938b5c-…'` → deve retornar 1 após a migração.
2. Logs do `openbot-webhook` param de mostrar `Integration not found for user`.
3. Cliente cola a URL no OpenBot e o próximo inbound dispara uma resposta de fluxo (visível no CRM como mensagem `outbound`).

## Arquivos tocados

- 1 migration SQL nova (trigger + função + backfill).
- Nenhum arquivo de código alterado.
