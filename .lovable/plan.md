## Objetivo

Renomear toda a marca **OpenFlow** para **Uz4Flow** em todo o projeto (frontend, backend/edge functions, landing pages, manifestos PWA, documentos legais e arquivos de auditoria).

Foram encontradas **111 ocorrências** distribuídas em **44 arquivos**.

## Regras de substituição

Aplicar substituição case-sensitive preservando a capitalização original:

- `OpenFlow` → `Uz4Flow`
- `OPENFLOW` → `UZ4FLOW`
- `openflow` → `uz4flow` (apenas em strings de UI/copy, identificadores em chaves de storage como `openflow:prospection:...` serão migrados para `uz4flow:prospection:...`)
- `OpenFlowCRM` → `Uz4FlowCRM` (vendor string em webm-to-ogg)

## Domínios e e-mails

- `openflow.studio` → `uz4flow.lovable.app` (já é a URL publicada do projeto, conforme project URLs)
- `suporte@openflow.studio` → `suporte@uz4flow.com` (placeholder — confirme em pergunta)
- `@openflow.studio` (handle Instagram em copy de afiliado) → `@uz4flow`
- CORS allow-list em `supabase/functions/_shared/cors.ts`: trocar `https://openflow.studio` e `https://www.openflow.studio` por `https://uz4flow.lovable.app`
- Fallbacks `FRONTEND_URL` em edge functions (`gdrive-oauth-callback`, `instagram-oauth`): trocar para `https://uz4flow.lovable.app`

## Arquivos a editar (agrupados)

**Configuração / Meta**
- `index.html` (title, description, author, OG, Twitter)
- `vite.config.ts` (manifest PWA name/short_name)
- `README.md`
- `supabase/functions/pwa-manifest/index.ts` (default `appName`)

**Landing & páginas públicas**
- `src/pages/Landing.tsx` (fallback `app_name`)
- `src/pages/PrivacyPolicy.tsx`
- `src/pages/TermsOfService.tsx`
- `src/pages/Auth.tsx`
- `src/pages/Install.tsx`
- `src/components/landing/LandingFAQ.tsx`
- `src/components/landing/LandingFooter.tsx`
- `src/components/landing/LandingPricing.tsx`
- `src/components/landing/LandingTestimonials.tsx`

**App (sidebar, dashboard, onboarding, LIA, planos)**
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/MyPlanCard.tsx`
- `src/components/lia/LiaChatPanel.tsx`
- `src/components/onboarding/OnboardingChecklist.tsx`
- `src/components/onboarding/WelcomeDialog.tsx`
- `src/components/SubscriptionGuard.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/McpGateway.tsx`

**Settings / Integrações / CRM**
- `src/components/settings/CRMCredentialsTab.tsx`
- `src/components/settings/FlowsCredentialsTab.tsx`
- `src/components/settings/IntegrationHelpAside.tsx`
- `src/components/crm/settings/EvalAIMappingDialog.tsx`
- `src/components/docs/DocsContent.tsx`
- `src/pages/admin/AdminSettings.tsx`

**Afiliados**
- `src/components/affiliates/AffiliateBanners.tsx` (texto SVG, nomes de download, link fallback)
- `src/components/affiliates/AffiliateCopyTemplates.tsx` (copy WhatsApp/Instagram/email)
- `src/components/affiliates/AffiliateHero.tsx`
- `src/components/affiliates/AffiliateOnboardingForm.tsx`
- `src/pages/AffiliateOnboardingPublic.tsx`
- `src/pages/admin/AdminAffiliates.tsx`

**Hooks / chaves de storage**
- `src/hooks/useProspectionPersistence.ts` (prefixos `openflow:prospection:*` → `uz4flow:prospection:*`)

**Edge functions (backend)**
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/webm-to-ogg.ts` (`OpenFlowCRM` → `Uz4FlowCRM`)
- `supabase/functions/crm-test-openbot/index.ts`
- `supabase/functions/gdrive-oauth-callback/index.ts`
- `supabase/functions/instagram-oauth/index.ts`
- `supabase/functions/lia-chat/index.ts` (system prompt da LIA)
- `supabase/functions/manage-integration/index.ts`
- `supabase/functions/webhook-eval-ai-mapping/index.ts`

**Documentação interna**
- `docs/audit/ui-audit-2026-04-21.md`
- `docs/audit/ui-sanity-check-2026-04-21.md`

## Configuração dinâmica em banco

A tabela `saas_settings` (key `general`) contém um campo `app_name` que pode estar setado como `"OpenFlow"`. Vou rodar uma migration para atualizar:

```sql
UPDATE public.saas_settings
SET value = jsonb_set(value, '{app_name}', '"Uz4Flow"')
WHERE key = 'general' AND value->>'app_name' = 'OpenFlow';
```

## Itens fora de escopo (não serão alterados)

- Memórias do projeto (`mem://`) — atualizadas separadamente se necessário.
- O ID do projeto Supabase, refs de integração, nomes de tabelas e funções já existentes no banco (somente o conteúdo `app_name` é atualizado).
- O nome do diretório `crm-test-openbot` (mantém — refere-se ao produto de terceiro "OpenBot", não a "OpenFlow").
- Arquivos `.lovable/plan.md` (artefato interno de planejamento).

## Perguntas para confirmar antes de executar

1. **Domínio do site / e-mail de suporte**: usar `https://uz4flow.lovable.app` e `suporte@uz4flow.com`? Ou você tem outro domínio próprio?
2. **Razão social** em Termos e Privacidade: hoje aparece **"Open Bot AI" (CNPJ 63.185.666/0001-81)** — devo manter essa razão social ou trocar também?
3. **Handle Instagram dos afiliados** (`@openflow.studio`): trocar para `@uz4flow`?