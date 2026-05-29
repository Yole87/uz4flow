## Diagnóstico

### 1. "OpenBot callback" no sino
Texto fixo legado em `supabase/functions/admin-notify-webhook/index.ts` (linha 25).

### 2. Notificação de novo cadastro via WhatsApp não chega
Causa raiz encontrada inspecionando a função `notify_admin_async` no banco: ela tem a **URL do Supabase do projeto antigo hardcoded**:

```
https://deuhtstjhuvyugilnifg.supabase.co/functions/v1/admin-notify
```

O projeto atual é `yjynquqwhnorsgzsakep`. Por isso o trigger `handle_new_user` "dispara", mas o POST vai para um host inexistente/de outro projeto — nenhum erro borbulha porque está dentro de `EXCEPTION WHEN OTHERS`. Última notificação real enviada com sucesso foi em **14/05/2026**. Depois disso só entram os *callbacks* do OpenBot (que chegam pelo webhook, sem depender da URL).

### 3. Tela "PERÍODO DE TESTE EXPIRADO" aparecendo logado como admin
Você está em `/dashboard` (não em `/admin`). O `SubscriptionGuard` tem bypass para admin, mas ele **respeita impersonation** (`src/components/SubscriptionGuard.tsx`, linhas 74-83): se `impersonate_org_id` estiver setado, o admin passa a ver exatamente o que o cliente impersonado veria — inclusive a tela de trial expirado da org dele. Provavelmente você iniciou uma impersonation em alguma org com trial vencido e o estado ficou no localStorage.

## Correções

### A) Renomear "OpenBot callback" → "Uz4FLOW callback"
Arquivo: `supabase/functions/admin-notify-webhook/index.ts`
- Linha 8 (comentário): substituir "OpenBot" por "Uz4FLOW"
- Linha 23 (comentário): idem
- Linha 25: `recipient_name: "Uz4FLOW callback"`
- Linha 37 (comentário): idem

### B) Corrigir URL hardcoded em `notify_admin_async`
Migration nova que recria a função usando a URL correta do projeto atual. Substituir o literal `https://deuhtstjhuvyugilnifg.supabase.co` por `https://yjynquqwhnorsgzsakep.supabase.co`. Manter o resto da lógica (cron-secret, EXCEPTION, payload) idêntico.

Resultado: a partir do próximo cadastro, o trigger `handle_new_user` dispara o POST para o admin-notify correto, que renderiza o template `signup_free` e envia via OpenBot para o número configurado em "Notificações Admin".

> Observação: se mesmo após o fix a entrega falhar, verificaremos em `admin_notification_logs.error_message`. Os 2 *failed* antigos foram "Token não encontrado" no OpenBot — se reaparecer, é configuração da API key de notificações admin (não código).

### C) Admin sempre vê a UI durante impersonation (não fica preso em trial expirado)
Arquivo: `src/components/SubscriptionGuard.tsx`
- Alterar a condição em `isAdmin` (linhas 80-83) para retornar `children` **também quando estiver impersonando**, independente do status da org impersonada. Hoje a checagem `if (isAdmin) return children;` já cobre isso — mas a tela está aparecendo porque o redirect da linha 76 só dispara em `/dashboard` *sem* impersonation. Vou auditar a ordem para garantir que admin **nunca** seja bloqueado por status da org alvo, apenas vê um aviso visual (já existe o `ImpersonationBanner`).
- Após a alteração, admin impersonando uma org com trial vencido vê o app normalmente, com o banner de impersonation indicando que está agindo como o cliente.

Se você na verdade *não* estava impersonando, fornecerei um botão "Sair da impersonation" mais visível e limparei o `localStorage.impersonate_org_id` ao trocar de conta.

## Validação
1. Sino: criar um novo cadastro de teste → notificação aparece como "Novo cadastro grátis" (não como callback) e o callback subsequente aparece como "Uz4FLOW callback".
2. WhatsApp: o número configurado em Admin → Notificações recebe a mensagem do template `signup_free`.
3. Dashboard: ao acessar `/dashboard` como admin (com ou sem impersonation), a tela "PERÍODO DE TESTE EXPIRADO" não aparece mais.
