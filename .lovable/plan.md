## Diagnóstico

O `src/App.tsx` importa **eagerly** todas as 40+ páginas do sistema (CRM, FlowEditor, Admin*, Reports, VoiceAI, etc.). Isso gera um bundle JavaScript inicial gigantesco — o navegador precisa baixar, parsear e executar TODO o código do app antes de mostrar qualquer tela, mesmo a de Login. É a causa principal do "demorando muito a carregar" (tela preta inicial vista no print).

Outros pontos secundários que aumentam o tempo até o primeiro render:
- `PublicRoute` (rota `/`) espera 3 chamadas sequenciais (auth + `useUserOrganization` + `useIsAdminMaster`) antes de renderizar.
- Falta de `Suspense` boundary global.

## Plano

### 1. Code-splitting por rota (principal ganho)

Em `src/App.tsx`:
- Converter todos os `import Page from "./pages/..."` em `const Page = lazy(() => import("./pages/..."))`.
- Manter eager apenas: `Auth`, `Landing`, `NotFound` (rotas de entrada — precisam ser instantâneas).
- Envolver `<AppRoutes />` em `<Suspense fallback={<spinner centralizado />}>`.

Resultado esperado: bundle inicial cai de ~vários MB para algumas centenas de KB; cada página carrega seu próprio chunk sob demanda.

### 2. Pré-carregar chunks "quentes" após login

Após o `Suspense` montar, disparar `import("./pages/Dashboard")`, `import("./pages/CRM")` e `import("./pages/Kanban")` em background (sem await) para que a navegação pós-login seja instantânea.

### 3. Otimizar `PublicRoute`

- Não bloquear render esperando `useOrganizationSubscription` se o usuário ainda nem chegou — só checar após `user` existir (já está, mas a query roda mesmo sem user).
- Garantir que `useIsAdminMaster` e `useUserOrganization` rodem em paralelo (já rodam; ok).

### 4. Validação

- Após o deploy, abrir a Preview e medir: tela de login deve aparecer em < 2s mesmo com cache frio.
- Verificar console por erros de chunk load.

## Detalhes técnicos

Arquivos alterados: **apenas `src/App.tsx`** (mudança isolada, sem tocar em backend, RLS, hooks de negócio ou componentes).

```tsx
import { lazy, Suspense } from "react";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const CRM = lazy(() => import("./pages/CRM"));
// ...idem para todas as outras

<Suspense fallback={<SpinnerFullscreen />}>
  <AppRoutes />
</Suspense>
```

Sem mudanças em rotas, guards, providers ou lógica de negócio.
