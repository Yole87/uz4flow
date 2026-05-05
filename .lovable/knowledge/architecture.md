# Arquitetura do Projeto

## Princípios

1. **Separação rigorosa frontend/backend**: Nenhuma regra de negócio, validação crítica ou cálculo sensível reside no frontend.
2. **Frontend = UI + API Client**: O frontend contém apenas interface, estados visuais, consumo de API e validações superficiais de UX.
3. **Backend = Edge Functions**: Toda lógica de negócio, cálculos, regras de assinatura e operações sensíveis ficam nas Edge Functions.

## Camadas

```
src/                          # Frontend (React + Vite)
├── services/                 # API Client Layer (sem lógica de negócio)
│   ├── api.ts               # Cliente base (wrapper do supabase.functions.invoke)
│   ├── organization.service.ts  # Organização + assinatura + limites
│   └── storage.service.ts   # Armazenamento
├── hooks/                    # React hooks (consomem services, armazenam estado via React Query)
├── components/               # Componentes UI puros
├── pages/                    # Páginas/rotas
└── lib/                      # Utilitários puros (formatação, etc.)

supabase/functions/           # Backend (Edge Functions = Controllers + Services)
├── organization-status/      # Status da org, assinatura, limites, storage, webhook URLs
├── mercadopago-subscription/ # Pagamentos + criação de organização
├── manage-integration/       # Integração OpenBot
├── _shared/                  # Utilitários backend (criptografia, etc.)
└── ...                       # Outras functions

Banco de Dados               # Repository Layer
├── Tabelas + RLS Policies
├── Views seguras (instances_safe, mcp_connections_safe)
├── Triggers
└── Functions (process_webhook_init, etc.)
```

## Padrões

### Hooks consomem Services (nunca acessam banco direto para regras de negócio)

```typescript
// ✅ CORRETO: Hook consome service
const { data } = useQuery({
  queryFn: () => organizationService.getOrganizationStatus()
});
// data.isActive já vem calculado do backend

// ❌ ERRADO: Hook calcula regras no frontend
const isActive = subscription?.status === "active" && !isBlocked && ...
```

### Services são API Clients puros

```typescript
// ✅ CORRETO: Service apenas chama backend
export async function getOrganizationStatus() {
  return invokeFunction("organization-status", { action: "get-status" });
}

// ❌ ERRADO: Service contém lógica de negócio
export function calculateDiscount(price: number, coupon: Coupon) { ... }
```

### Webhook URLs vêm do backend

```typescript
// ✅ CORRETO: Hook busca URLs do backend
const { getUrl } = useWebhookUrls();
const webhookUrl = getUrl("openbot");

// ❌ ERRADO: Frontend constrói URLs
const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openbot-webhook`;
```

### Criação de organização no backend

```typescript
// ✅ CORRETO: Backend cria org durante checkout
await supabase.functions.invoke("mercadopago-subscription", {
  body: { action: "create-subscription", orgName: "Minha Empresa", planId }
});

// ❌ ERRADO: Frontend cria org diretamente
await supabase.from("organizations").insert({ ... });
```

## Edge Function: organization-status

Centraliza toda lógica de status:

- `get-status`: Retorna isActive, isTrial, features, storage usage etc.
- `get-webhook-urls`: Retorna URLs de webhook montadas no backend

## Segurança

- Chaves API criptografadas com AES-256-GCM (SYSTEM_CRIPTOGRAFIA_MASTER_KEY como secret)
- Views seguras (`instances_safe`) com SECURITY INVOKER
- RLS policies em todas as tabelas
- Tokens e segredos nunca expostos ao frontend
- Frontend recebe apenas flags booleanas (hasApiKey, isConfigured)
