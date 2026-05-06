
# Plano de Correção

Após o remix, dois problemas foram identificados:

1. As abas **Eventos** e **Templates** de Notificações estão vazias — as tabelas `admin_notification_rules` e `admin_notification_templates` existem mas nunca foram populadas (a migração original cria a estrutura mas não tem seed).
2. O botão **Testar Conexão** do Mercado Pago retorna "Verifique se o Access Token está configurado corretamente", mesmo com o secret `MERCADOPAGO_ACCESS_TOKEN` recém-atualizado.

Divido a correção em duas features independentes.

---

## Feature 1 — Seed das Notificações Administrativas

**Objetivo:** popular as 10 regras de evento e os 10 templates padrão exibidos na captura de tela (Novo cadastro grátis, Plano grátis vencendo, Upgrade grátis → pago, Mudança de plano, Pagamento recebido, Cancelamento por reembolso, Cancelamento por inadimplência, Pedido de afiliação, Novo indicado por afiliado, Pedido de saque de afiliado).

**Ações:**
- Criar migration que faz `INSERT ... ON CONFLICT DO NOTHING` em:
  - `admin_notification_templates` — uma linha por `event_type` do enum `admin_notif_event`, com `name`, `body` (texto com placeholders `{user_name}`, `{user_email}`, `{plan_name}`, `{amount}`, `{date}`, `{affiliate_name}`, `{affiliate_code}`, `{status}`, `{reason}`, `{days}`, `{net_amount}`, `{pix_key}`) e `variables[]` correspondentes.
  - `admin_notification_rules` — uma linha por `event_type` com `enabled = true` e `template_id` referenciando o template recém-criado.
- Conteúdo dos textos seguindo exatamente o que aparece na captura "TEMPLATES" enviada.
- Seed idempotente, seguro para rodar em qualquer ambiente.

**Resultado:** ao abrir `/admin/notifications`, ambas as abas Eventos e Templates aparecem populadas.

---

## Feature 2 — Diagnóstico e Correção do "Testar Conexão" do Mercado Pago

**Causa provável:** a edge function `mercadopago-subscription` lê o token primeiro de `Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")` e cai no fallback do `saas_settings.mercadopago_access_token_encrypted`. Como esse registro não existe no banco do projeto remixado, a conexão depende exclusivamente do secret de ambiente. Se o token enviado for inválido (ex.: copiado errado, expirado, ou de outra conta), a Meta API retorna 401 e o frontend mostra a mensagem genérica "Verifique se o Access Token está configurado corretamente".

**Ações:**
1. **Melhorar o erro retornado** pela edge function `mercadopago-subscription` no branch `test-connection`:
   - Em vez de "Failed to connect to Mercado Pago", retornar o status HTTP e mensagem da Mercado Pago (ex.: `invalid_access_token`, `token expired`) — mantendo a sanitização para não vazar segredos.
   - Distinguir explicitamente entre "token não configurado" e "token rejeitado pela MP".
2. **Atualizar o frontend** (`src/pages/admin/AdminSettings.tsx`) para exibir o `data.error` real no toast em vez do texto genérico, ajudando o usuário a entender se precisa salvar de novo o token ou gerar um novo no painel da Mercado Pago.
3. **Salvar o token também via UI no banco (criptografado)** usando o fluxo já existente `save-access-token`, para que o app não dependa apenas do secret de ambiente. O campo `Access Token` na tela já existe — basta orientar o usuário a colar o token e clicar em Salvar antes de Testar.
4. **Documentar no toast** que após salvar o token via UI, o teste passa a usar o valor do banco (criptografado AES-256-GCM), independente do secret.

**Resultado:** ao clicar "Testar Conexão", o usuário recebe uma mensagem clara (ex.: "Token rejeitado pela Mercado Pago — verifique se copiou o Access Token correto da sua conta de produção") e tem caminho claro para corrigir.

---

## Detalhes técnicos

- **Migrations:** apenas `INSERT` em tabelas `public.admin_notification_*`. Sem alteração de schema, sem afetar RLS existente.
- **Edge function:** apenas o branch `test-connection` (linhas 334–360 de `supabase/functions/mercadopago-subscription/index.ts`) precisa ser ajustado. Sem mudança em outros endpoints.
- **Frontend:** ajuste localizado em `AdminSettings.tsx` (função `testConnection`, linhas 203–255).
- **Segurança:** mensagens de erro continuam sanitizadas (sem expor token nem stack trace), apenas o `error_message` da MP é repassado.
- **Observação importante sobre a Feature 2:** se após melhorar o erro a MP responder "invalid_access_token", a correção definitiva é o usuário fornecer um token válido — é uma questão de credencial, não de código. O plano garante que o sistema diga isso com clareza.
