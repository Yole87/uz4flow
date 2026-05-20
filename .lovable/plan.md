# Corrigir erro "Configure a URL de entrada..." ao testar Conectores e Fluxos

## Diagnóstico

A instância **11-5194-0907** (provedor `meta_official`, organização `imaisdigitalbrasil@gmail.com`) **possui** os dados necessários no banco:

- `api_url` = `https://api.digitalbotia.com.br/sendWebhook`
- `openbot_api_key_encrypted` / `api_key_encrypted` preenchidos

A tabela `integrations` do usuário, porém, está **vazia** (sem `openbot_inbound_url` e sem `openbot_api_key_encrypted`).

A função `manage-integration` (ação `test`) já foi atualizada para procurar primeiro pela instância (via `instance_id`) e só depois cair no fallback do usuário. O front (`FlowsCredentialsTab`) já envia `instance_id`. Os logs mostram que a função foi reimplantada às 15:46Z, mas **não há nenhuma invocação `test` registrada após o deploy** — ou seja, o erro do print foi gerado pela versão anterior da função, que ainda não conhecia `instance_id` e caía no fallback do usuário (vazio), retornando 400.

Causa provável: cache do navegador / requisição feita antes do deploy concluir.

## Correções propostas

1. **Pedir ao usuário para recarregar a página (hard refresh) e testar novamente.** A versão atual já resolve corretamente via instância.

2. **Hardening do backend (`manage-integration`, ação `test`)** para evitar reincidência:
   - Quando `instance_id` é informado mas a instância pertence a outra organização ou não tem chave/URL, devolver uma mensagem de erro **específica** (ex.: "Instância sem URL de entrada configurada" / "Instância sem API Key"), em vez da mensagem genérica que pede para configurar a URL no formulário (que nem existe mais nesta aba).
   - Seguindo o padrão `friendly-error-reporting`, retornar `status: 200` com `{ success: false, error: "..." }` para que o `toast` mostre a causa real.

3. **Hardening do frontend (`FlowsCredentialsTab.handleTest`)** para exibir o `error` retornado pela função com fidelidade (já faz) e logar em console o `instance_id` enviado, facilitando suporte futuro.

4. **Validação manual pós-deploy**: testar o botão "Testar Conexão" no card da instância 11-5194-0907 e confirmar resposta `success: true` (a instância chama `https://api.digitalbotia.com.br/sendWebhook` com a API Key do Sistema de WhatsApp AI gravada).

## Fora de escopo

- Não criar registro em `integrations` para este usuário (config por instância já é suficiente).
- Não alterar layout da aba Conectores e Fluxos.

## Detalhes técnicos

Arquivos a editar:
- `supabase/functions/manage-integration/index.ts` — refinar mensagens de erro do bloco `if (body.action === "test")` (linhas ~262–328), trocar 400 por 200 com `success: false`.
- `src/components/settings/FlowsCredentialsTab.tsx` — `handleTest`: adicionar `console.log("[FlowsTest] instance_id", instanceId)` e exibir `result.error` literal no toast quando vier do backend.
