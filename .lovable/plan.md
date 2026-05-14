## Diagnóstico

Você está logada como **admin_master**, mas a rota `/` usa `PublicRoute`, que só redireciona automaticamente para `/dashboard` quando o usuário tem **organização própria + assinatura ativa**.

Como o `admin_master` normalmente **não tem organização** (é usuário operacional do SaaS), o fluxo trava assim:

1. `PublicRoute` espera `useUserOrganization` (queries em `organizations` e `organization_members`)
2. Ambas retornam `null`
3. Resultado: cai na tela de login do `Auth.tsx`, que ainda precisa carregar branding/logo → durante esses ~2-4s a área aparece **preta** (background dark do tema antes do conteúdo pintar)
4. Mesmo após pintar, é a tela de login — não o `/admin` que você espera

Ou seja: não há bug de tela travada para sempre; é um redirecionamento ausente que faz o admin perder tempo numa tela inútil.

---

## Plano (1 alteração pequena, só frontend)

**Arquivo:** `src/App.tsx` — função `PublicRoute`

Adicionar uma checagem extra: se o usuário logado for `admin_master`, redirecionar imediatamente para `/admin`, **antes** de esperar pelas queries de organização.

Lógica final do `PublicRoute`:

```text
1. loading auth?  → spinner
2. user existe?
   2a. checar role admin_master (RPC has_role) — em paralelo às queries de org
   2b. se admin_master → <Navigate to="/admin" />
   2c. se org + assinatura ativa → <Navigate to="/dashboard" />
3. caso contrário → renderizar children (Auth/Login)
```

Implementação:
- Criar pequeno hook local `useIsAdminMaster()` que chama `supabase.rpc("has_role", { _user_id, _role: "admin_master" })` (mesmo padrão já usado em `AdminGuard.tsx`).
- No `PublicRoute`, se `user && isAdminMaster === true` → `<Navigate to="/admin" replace />`.
- Enquanto a checagem de role está pendente E o usuário está logado, manter o spinner (evita flash de tela de login).

Nada mais muda. `AdminGuard` continua protegendo as rotas `/admin/*` no servidor de regras.

---

## Verificação após aplicar

1. Logada como `admin_master`, abrir `https://uz4flow.com.br/` → deve ir direto para `/admin` (sem flash da tela de login).
2. Logada como usuário comum com assinatura → continua indo para `/dashboard`.
3. Sem login → continua mostrando a tela de `Auth`.

Posso aplicar?
