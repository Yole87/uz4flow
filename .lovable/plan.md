## O que é o erro

O toast **"Erro: Inbound URL is required"** vem da Edge Function `manage-integration`, na ação `test` (linha ~265 de `supabase/functions/manage-integration/index.ts`):

```ts
if (!inboundUrl) {
  return new Response(JSON.stringify({ error: "Inbound URL is required" }), { status: 400, ... });
}
```

A aba **"Conectores e Fluxos"** das instâncias do WhatsApp é renderizada por `src/components/settings/FlowsCredentialsTab.tsx`. Essa aba foi simplificada — ela mostra apenas a URL do webhook (leitura) + Webhook Secret. Quando o usuário clica em **"Testar Conexão"**, o frontend chama a função com:

```ts
body: JSON.stringify({ action: "test" })   // SEM inboundUrl
```

Como o backend exige `inboundUrl` no payload, ele responde 400 e o toast exibe a mensagem. Isso acontece em **todas** as instâncias porque o bug é no componente comum, não na configuração de cada conta.

A `openbot_inbound_url` (URL do Sistema de WhatsApp AI para onde mandamos as mensagens) já está salva no banco em `public.integrations` para o usuário — só não está sendo lida no momento do teste.

## Plano de correção (cirúrgico, não quebra nada)

**Escopo:** apenas a Edge Function `manage-integration`. Frontend e demais componentes ficam intactos.

1. Na ação `test` da função, **deixar `inboundUrl` opcional no body**.
2. Se não vier no body, buscar a `openbot_inbound_url` salva em `integrations` do usuário (já é buscada para a API key — vamos só incluir o campo no `select`).
3. Validar **depois**: se nem o body trouxe nem o banco tem `openbot_inbound_url`, retornar erro amigável: *"Configure a URL de entrada do Sistema de WhatsApp AI antes de testar."* (em vez do críptico "Inbound URL is required").
4. Manter a action `save` como está — ela continua salvando `inboundUrl` quando o usuário envia.
5. Tipar `TestConnectionRequest.inboundUrl` como opcional (`inboundUrl?: string`).

## Por que essa abordagem é segura

- Não altera RLS, schema, nem outras funções.
- Não muda o comportamento da aba "Credenciais CRM" nem da configuração Instagram/Voice.
- Mantém a validação real: se realmente não houver URL configurada, ainda bloqueia o teste — só que com mensagem clara.
- Reaproveita o registro já existente em `integrations` (que é por `user_id`), então cada conta WhatsApp do tenant lê a URL correta do seu próprio dono.

## Verificação após implementar

1. Abrir Conexões → WhatsApp → uma instância → aba "Conectores e Fluxos" → clicar **Testar Conexão**.
2. Resultado esperado: toast verde "Conexão testada com sucesso" (se a `openbot_inbound_url` estiver salva e a API Key válida), ou toast claro pedindo para configurar a URL se nunca foi salva.
3. Repetir em outra instância para confirmar que não é mais um erro genérico.
4. Conferir logs da função `manage-integration` (ação `test`) — não deve mais aparecer "Inbound URL is required" como motivo de falha.

## Observação adicional

A aba simplificada não permite mais que o usuário digite/edite a `inboundUrl` ali. Se você quiser, posso (numa próxima iteração) reexpor esse campo na aba, mas isso é melhoria de UX — não é necessário para resolver o erro atual, já que a URL já existe no banco do tenant.