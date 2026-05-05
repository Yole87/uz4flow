# Sanity Check UI OpenFlow — 2026-04-21

Verificação pós-Ondas A–E. Esta auditoria **não corrige** nada — apenas reporta o estado atual de `src/` após 5 ondas de polimento de UI.

## Metodologia

Foram executados 8 greps sobre `src/` com as seguintes exclusões:

- **`src/components/ui/`** — componentes shadcn baseline, não auditados.
- **`src/lib/provider-colors.ts`** — exceção documentada (cores de marca de provedores externos: Kiwify/Hotmart/Eduzz).
- **`src/components/crm/EmojiPicker.tsx`** — catálogo de emojis (intencional).
- **`src/lib/errorMessages.ts`** — strings de erro server-side, não UI.
- **`__tests__/` e `/test/`** — código de teste.

Padrões de busca abaixo, em cada seção.

## Resultado consolidado

| Categoria | Ocorrências | Status |
|-----------|-------------|--------|
| Cores Tailwind cruas | **318** | ⚠️ alto débito — concentrar em flow nodes |
| `text-[Xpx]` arbitrário (todos ≤11px) | **313** | ⚠️ P0 — quebra de a11y/legibilidade |
| Dimensões `[w/h/min/max]-[…]` | **255** | ℹ️ listado para revisão (maioria legítima) |
| Emojis em UI | **54** | ⚠️ ~30 candidatos a substituição por Lucide |
| `<button>` HTML cru | **30** | ℹ️ maioria legítima (a11y-helpers, players) |
| `<input>`/`<textarea>` HTML cru | **2** | ✅ ambos legítimos (file inputs ocultos) |
| Inline HSL/RGB/hex | **12** | ℹ️ maioria legítima (overlay LIA, gradientes de marca) |
| `any` TypeScript | **428** | ℹ️ débito de tipagem — escopo de auditoria de código, não de UI |

---

## Detalhamento por categoria

### 1. Cores cruas remanescentes (318)

**Padrão:** `(bg|text|border|ring|from|to|via|placeholder|caret|decoration|divide)-(red|green|yellow|blue|emerald|amber|orange|purple|pink|cyan|indigo|teal|rose|sky|lime|violet|fuchsia)-[0-9]+(/[0-9]+)?`

**Top 15 classes mais usadas:**

| Classe | Ocorrências |
|--------|------------:|
| `text-emerald-500` | 30 |
| `text-emerald-400` | 26 |
| `text-amber-500` | 22 |
| `bg-emerald-500` | 14 |
| `text-yellow-500` | 12 |
| `text-yellow-400` | 12 |
| `text-amber-400` | 11 |
| `border-emerald-500/50` | 10 |
| `bg-emerald-500/10` | 10 |
| `text-fuchsia-400` | 9 |
| `border-emerald-500/30` | 9 |
| `border-amber-500/30` | 9 |
| `bg-green-500` | 9 |
| `bg-amber-500` | 9 |
| `text-blue-400` | 8 |

**Padrão claro:** paleta verde (emerald/green) e âmbar (amber/yellow) usada como semântica de status (ok/atenção) em vez dos tokens `success`/`warning`. Concentrada em:

| Arquivo | Cores cruas |
|---------|------------:|
| `src/components/flows/TriggerNode.tsx` | 17 |
| `src/components/flows/TriggerConfigDialog.tsx` | 13 |
| `src/components/docs/DocCallout.tsx` | 12 |
| `src/components/flows/FlowNodeSidebar.tsx` | 11 |
| `src/components/flows/VoiceCallNode.tsx` | 10 |
| `src/pages/admin/AdminSettings.tsx` | 9 |
| `src/components/flows/ConditionNode.tsx` | 9 |
| `src/components/docs/DocsContent.tsx` | 9 |
| `src/components/crm/import/ImportStepPreview.tsx` | 9 |
| `src/components/flows/MenuNode.tsx` | 8 |
| `src/components/flows/ConditionConfigDialog.tsx` | 8 |
| `src/components/flows/ActiveMessageNode.tsx` | 8 |
| `src/components/voice/FlowVoiceCallsTab.tsx` | 7 |
| `src/components/flows/VoiceCallConfigDialog.tsx` | 7 |
| `src/components/crm/CRMEmptyState.tsx` | 7 |
| `src/components/flows/TagNode.tsx` | 6 |
| `src/components/flows/RandomNode.tsx` | 6 |
| `src/components/flows/LaneNode.tsx` | 6 |
| `src/components/flows/FlowAIPanel.tsx` | 6 |
| `src/components/flows/BlockContentDialog.tsx` | 6 |

**Amostra (20 primeiros pares arquivo:linha — classe):**

```
src/components/StorageUsageBadge.tsx:13 — text-yellow-500
src/components/StorageUsageCard.tsx:24 — bg-yellow-500
src/components/StorageUsageCard.tsx:67 — bg-yellow-500/10 border-yellow-500/20
src/components/StorageUsageCard.tsx:68 — text-yellow-500
src/components/StorageUsageCard.tsx:69 — text-yellow-600 dark:text-yellow-400
src/components/affiliates/AffiliateOverviewTab.tsx:34 — text-blue-500
src/components/affiliates/AffiliateOverviewTab.tsx:35 — text-purple-500
src/components/checkout/CouponInput.tsx:82 — bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800
src/components/checkout/CouponInput.tsx:85 — text-green-600 dark:text-green-400
src/components/checkout/CouponInput.tsx:86 — text-green-700 dark:text-green-300
src/components/checkout/CouponInput.tsx:89 — text-green-600 dark:text-green-400
src/components/checkout/CouponInput.tsx:101 — text-green-600 hover:text-green-700 hover:bg-green-100
src/components/checkout/PriceSummary.tsx:46 — text-green-600 dark:text-green-400
src/components/crm/AIInsightsCard.tsx:93 — text-yellow-400
src/components/crm/AIInsightsCard.tsx:104 — from-purple-900/30 border-purple-500/30 shadow-purple-500/10
src/components/crm/AIInsightsCard.tsx:107 — text-purple-400
src/components/crm/AIInsightsCard.tsx:167 — border-purple-500
src/components/crm/AIInsightsCard.tsx:210 — text-purple-400 hover:text-purple-300 hover:bg-purple-900/20
src/components/crm/AIInsightsCard.tsx:224 — from-purple-600 to-accent hover:from-purple-500
src/components/crm/CRMEmptyState.tsx:12 — text-emerald-500
```

**+298 outras** — padrão repetido (status verde/âmbar e gradientes roxos hardcoded).

---

### 2. `text-[Xpx]` remanescentes (313)

**Padrão:** `text-\[[^\]]*?(px|rem)\]`

**Distribuição (todos ≤ 11px — categoria "nunca aceitáveis"):**

| Tamanho | Ocorrências |
|---------|------------:|
| `text-[10px]` | 204 |
| `text-[11px]` | 71 |
| `text-[9px]` | 37 |
| `text-[8px]` | 2 (alarmante — ilegível em qualquer dispositivo) |

**Top 15 arquivos:**

| Arquivo | Ocorrências |
|---------|------------:|
| `src/pages/Dashboard.tsx` | 26 |
| `src/components/crm/settings/OpenBotConfigCard.tsx` | 15 |
| `src/components/flows/FlowExecutionLogs.tsx` | 12 |
| `src/components/crm/ContactDetailPane.tsx` | 10 |
| `src/components/settings/TeamProfilesTab.tsx` | 9 |
| `src/components/crm/settings/EvaluationLogsCard.tsx` | 8 |
| `src/components/crm/ConversationEvalCard.tsx` | 8 |
| `src/components/crm/AllRemindersDialog.tsx` | 7 |
| `src/components/settings/TeamMembersTab.tsx` | 6 |
| `src/components/reports/FunnelTab.tsx` | 6 |
| `src/components/flows/TriggerNode.tsx` | 6 |
| `src/components/flows/FlowStepNode.tsx` | 6 |
| `src/components/flows/FlowAIPanel.tsx` | 6 |
| `src/components/crm/QuickReplyManager.tsx` | 6 |
| `src/components/crm/InstanceSelector.tsx` | 6 |

**Amostra (20 primeiros):**

```
src/components/admin/AdminLayout.tsx:108 — text-[10px] (env badge)
src/components/admin/AdminLayout.tsx:195 — text-[10px] (env badge)
src/components/admin/AdminNotificationBell.tsx:139 — text-[10px] (badge contador)
src/components/admin/AdminNotificationBell.tsx:221 — text-[10px] (timestamp)
src/components/admin/PaymentWebhookLogs.tsx:123 — text-[10px] (badge)
src/components/crm/AllRemindersDialog.tsx:86 — text-[10px] (badge)
src/components/crm/AllRemindersDialog.tsx:94 — text-[10px] (badge)
src/components/crm/AllRemindersDialog.tsx:102 — text-[10px] (badge)
src/components/crm/AllRemindersDialog.tsx:129 — text-[10px] (badge destructive)
src/components/crm/AllRemindersDialog.tsx:134 — text-[10px] (badge success)
src/components/crm/AllRemindersDialog.tsx:137 — text-[10px] (badge secondary)
src/components/crm/AllRemindersDialog.tsx:145 — text-[11px] (timestamp)
src/components/crm/CRMEmptyState.tsx:51 — text-[11px] (numerador círculo)
src/components/crm/CRMEmptyState.tsx:58 — text-[11px] (numerador círculo)
src/components/crm/CRMEmptyState.tsx:65 — text-[11px] (numerador círculo)
src/components/crm/CRMLayout.tsx:203 — text-[11px] (tab text)
src/components/crm/CRMLayout.tsx:213 — text-[11px] (tab text)
src/components/crm/ChatPane.tsx:647 — text-[10px] (badge)
src/components/crm/ChatPane.tsx:697 — text-[10px] (badge contador)
src/components/crm/ChatPane.tsx:870 — text-[11px] (datestamp divisor)
```

**+293 outras** — predominam badges, contadores, divisores de data e labels técnicas no Dashboard.

---

### 3. Dimensões arbitrárias (255)

**Padrão:** `(w|h|min-w|min-h|max-w|max-h)-\[[^\]]+\]`

**Top 20 arquivos** (apenas listagem — muitas são legítimas: `max-h-[80svh]` em dialogs, `min-w-[18px]` em badges):

| Arquivo | Ocorrências |
|---------|------------:|
| `src/components/crm/ContactsListPane.tsx` | 10 |
| `src/components/instagram/InstagramAutomationEditor.tsx` | 9 |
| `src/components/docs/DocsContent.tsx` | 7 |
| `src/pages/FlowResults.tsx` | 6 |
| `src/components/instagram/InstagramInsightsTab.tsx` | 6 |
| `src/components/crm/VoiceCallDialog.tsx` | 6 |
| `src/pages/ConnectorHistory.tsx` | 5 |
| `src/components/crm/settings/ConversationEvalConfigCard.tsx` | 5 |
| `src/components/settings/TeamMembersTab.tsx` | 4 |
| `src/components/instagram/InstagramLogsTab.tsx` | 4 |
| `src/components/crm/QuickReplyManager.tsx` | 4 |
| `src/components/crm/InstanceSelector.tsx` | 4 |
| `src/components/admin/PaymentWebhookLogs.tsx` | 4 |
| `src/pages/admin/AdminPlans.tsx` | 3 |
| `src/pages/admin/AdminAffiliates.tsx` | 3 |
| `src/pages/History.tsx` | 3 |
| `src/pages/Dashboard.tsx` | 3 |
| `src/components/lia/LiaChatPanel.tsx` | 3 |
| `src/components/landing/LandingHero.tsx` | 3 |
| (demais com 1–2 ocorrências) | — |

---

### 4. Emojis em UI (54)

**Padrão:** literais `✅ ❌ 🚀 📞 🎉 💬 ⚠️ 📌 🎯 🔥 💡 ⭐ 📊 📈 📉 🔔 🔒 🔓 🛑 ⛔ 🌟 ✨ 💎 🏆` em `*.tsx`/`*.ts`.

**Lista completa (arquivo:linha — emoji — string):**

```
src/components/admin/billing/BillingConfigTab.tsx:125 — ✅/⚠️ — "API Key configurada / não configurada"
src/components/affiliates/AffiliateCopyTemplates.tsx:18 — 🚀 — copy template WhatsApp [INTENCIONAL — copy social]
src/components/affiliates/AffiliateCopyTemplates.tsx:20-23 — ✅×4 — bullets de copy [INTENCIONAL]
src/components/affiliates/AffiliateCopyTemplates.tsx:30 — 🔥 — copy Instagram [INTENCIONAL]
src/components/affiliates/AffiliateCopyTemplates.tsx:68 — 📌 — dica reels [INTENCIONAL]
src/components/affiliates/AffiliateCopyTemplates.tsx:145 — 💡 — "Dicas que convertem" (CardTitle, UI)
src/components/connectors/InteractionEditor.tsx:388 — 💡 — Dica (texto de UI)
src/components/crm/AddInstanceDialog.tsx:237 — 💡 — "Detecção Automática"
src/components/crm/ContactDetailPane.tsx:661 — ✅ — "Ação: ..."
src/components/crm/DeleteAllConversationsDialog.tsx:123 — ⚠️ — "Atenção: ..."
src/components/crm/EditInstanceDialog.tsx:333 — ⚠️ — warning Phone Number ID
src/components/crm/LeadRotationConfig.tsx:223 — 💡 — "Como funciona"
src/components/crm/PipelineAutomationDialog.tsx:346 — 💡 — "Veja como funciona"
src/components/crm/PipelineAutomationDialog.tsx:361 — ✨ — final de texto
src/components/crm/RemindersBell.tsx:57 — 🔔 — referência ao próprio botão
src/components/crm/VoiceCallCard.tsx:40 — 📞 — "Ligação IA"
src/components/crm/VoiceCallDialog.tsx:215,230,307 — 💡×3 — explicações de custo
src/components/crm/prospection/ProspectionSearchForm.tsx:428 — 💡 — dica
src/components/crm/prospection/ProspectionSearchForm.tsx:460 — ⚠️ — atenção
src/components/crm/settings/ConversationEvalConfigCard.tsx:566,580,584 — ✅/📌 — selects
src/components/crm/settings/ConversationEvalConfigCard.tsx:910 — 📊👤📱📝🟢📋 — preview de mensagem WhatsApp [INTENCIONAL — preview do que será enviado]
src/components/docs/DocsContent.tsx:960 — 🎉 — exemplo de markdown [INTENCIONAL — conteúdo educativo]
src/components/docs/DocsContent.tsx:1124,1128 — 💬×2 — labels "DM Recebida" / "Comentário"
src/components/flows/FlowAIPanel.tsx:107,125 — ❌×2 — mensagem de erro do chat LIA
src/components/instagram/InstagramAutomationEditor.tsx:862 — 💡 — dica
src/components/instagram/InstagramConfigTab.tsx:422 — ⚠️ — atenção URI
src/components/lia/LiaChatPanel.tsx:93 — ✅ — replace de markdown (substituição programática)
src/components/settings/FlowsConfigCard.tsx:109 — ✅ — toast.success
src/components/settings/FlowsConfigCard.tsx:191 — ⚠️ — AlertTitle
src/components/onboarding/WelcomeDialog.tsx:29 — 🎉 — boas-vindas
src/components/onboarding/OnboardingChecklist.tsx:85 — 🎉 — "Tudo pronto!"
src/components/reports/FunnelTab.tsx:204 — 🎉 — empty state positivo
src/hooks/useAgentReminders.ts:88 — 🔔×2 — title de toast
src/pages/Auth.tsx:90 — 🎉 — toast bem-vindo
src/pages/Auth.tsx:104 — 🚀 — toast cadastro
src/pages/ConnectorWizard.tsx:608 — 📎/💬 — "Arquivo / Texto"
src/pages/FlowEditor.tsx:841 — 🛑 — log de fluxo finalizado
src/pages/FlowEditor.tsx:1251 — 💡 — dica
src/pages/FlowEditor.tsx:1725 — 💡 — dica
src/pages/Flows.tsx:231,241 — ✅/🎉 — toasts
src/pages/Rules.tsx:184,191 — ✅/🎉 — toasts
src/pages/Rules.tsx:378 — ⚠️ — alerta
src/pages/Dashboard.tsx:519 — 🎉 — header welcome
```

**Resumo:** ~30 substituíveis por Lucide (`Lightbulb`, `AlertTriangle`, `CheckCircle2`, `Phone`, `Sparkles`, `Bell`, `MessageCircle`, `Paperclip`, `StopCircle`, `PartyPopper`); ~15 intencionais (copy social, exemplos de docs, previews de mensagens enviadas).

---

### 5. `<button>` HTML crus (30)

**Lista completa:**

```
src/components/crm/EditInstanceDialog.tsx:163 — type="button" aria-label (tooltip helper) — LEGÍTIMO
src/components/crm/EditInstanceDialog.tsx:187 — idem — LEGÍTIMO
src/components/crm/EditInstanceDialog.tsx:216 — idem — LEGÍTIMO
src/components/crm/EditInstanceDialog.tsx:315 — idem — LEGÍTIMO
src/components/crm/prospection/ProspectionSearchForm.tsx:317 — tooltip helper — LEGÍTIMO
src/components/docs/DocSection.tsx:46 — accordion trigger custom — revisar
src/components/flows/ActiveMessageConfigDialog.tsx:397 — chip remove (X tag) — revisar
src/components/flows/ActiveMessageConfigDialog.tsx:439 — chip remove (X phone) — revisar
src/components/instagram/InstagramLogsTab.tsx:197 — row clicável — revisar
src/components/pwa/InstallPrompt.tsx:50 — close (X) — LEGÍTIMO
src/components/settings/InstanceDetailCard.tsx:66 — collapsible trigger custom — revisar
src/components/settings/InstanceRegistrationCard.tsx:119,139,158 — tooltip helpers — LEGÍTIMO
src/components/settings/NewInstanceButton.tsx:127,147,166 — tooltip helpers — LEGÍTIMO
src/components/tutorials/YouTubePlayer.tsx:292,298,359 — controles do player (play/mute/fullscreen) — LEGÍTIMO (a11y custom)
src/pages/FlowEditor.tsx:1381 — revisar
src/pages/admin/AdminAffiliates.tsx:478 — tooltip helper — LEGÍTIMO
src/pages/admin/AdminNotifications.tsx:143 — template selector — revisar
src/pages/Dashboard.tsx:785,846,890,943,994,1046 — accordion-like clickable headers (×6) — revisar
src/pages/Dashboard.tsx:902 — link inline dentro de descrição — LEGÍTIMO
```

**Resumo:** ~18 legítimos (tooltip helpers padronizados, controles a11y custom, close icons), ~12 candidatos a migrar para `<Button variant="ghost">` ou `<Collapsible>` do shadcn.

---

### 6. `<input>`/`<textarea>` HTML crus (2)

```
src/components/crm/ChatPane.tsx:995 — <input type="file" hidden ref={fileInputRef} — LEGÍTIMO (file picker programático)
src/components/followup/ContactImportTab.tsx:166 — <input type="file" hidden ref={fileInputRef} — LEGÍTIMO (file picker programático)
```

**✅ Ambos legítimos.** Padrão correto para file inputs invisíveis acionados por botão. Nada a fazer.

---

### 7. Inline HSL/RGB/hex (12)

```
src/components/crm/ContactListItem.tsx:189 — backgroundColor: stage.color || "hsl(var(--muted-foreground))" — LEGÍTIMO (cor dinâmica de stage do usuário)
src/components/crm/ContactsFilterPopover.tsx:320 — backgroundColor: stage.color || "#71717a" — revisar fallback (usar token)
src/components/crm/PipelineAutomationDialog.tsx:296 — backgroundColor: s.color || "#71717a" — revisar fallback (usar token)
src/components/landing/LandingFooter.tsx:23 — borderImage: 'linear-gradient(135deg, hsl(180 100% 50%), hsl(272 100% 50%))' — gradiente de marca, LEGÍTIMO
src/components/landing/LandingHeader.tsx:74 — gradiente vertical de marca — LEGÍTIMO
src/components/layout/AppSidebar.tsx:418 — borderTop: '1px solid rgba(255,255,255,0.08)' — revisar (usar border-border/40)
src/components/lia/GuidedOverlay.tsx:196,198,200,202 — background: "rgba(0,0,0,0.7)" ×4 — overlay spotlight, LEGÍTIMO (mask 4 lados)
src/components/reports/FunnelTab.tsx:141 — background: stage.color || "hsl(var(--primary))" — LEGÍTIMO (cor dinâmica)
src/components/reports/TeamTab.tsx:226 — background: `hsl(var(--primary) / ${i})` — LEGÍTIMO (opacidade dinâmica em loop)
```

**Resumo:** 9 legítimos (cores dinâmicas de stage, gradientes de marca, overlay LIA), 3 a revisar (fallbacks `#71717a` em 2 lugares + 1 `rgba` na sidebar — todos substituíveis por tokens).

---

### 8. `any` TypeScript — prévia de auditoria de código (428)

**Não é issue de UI**, mas mapeado para próxima fase.

**Top 20 arquivos:**

| Arquivo | `any` |
|---------|------:|
| `src/pages/admin/AdminAffiliates.tsx` | 29 |
| `src/pages/admin/AdminNotifications.tsx` | 18 |
| `src/pages/FlowEditor.tsx` | 18 |
| `src/components/crm/ContactsListPane.tsx` | 17 |
| `src/pages/Tutorials.tsx` | 15 |
| `src/components/flows/FlowImportExport.ts` | 13 |
| `src/hooks/useQuickReplies.ts` | 11 |
| `src/hooks/reports/useReportData.ts` | 10 |
| `src/components/settings/TeamMembersTab.tsx` | 10 |
| `src/components/followup/FollowUpCampaignForm.tsx` | 9 |
| `src/hooks/useContactFolders.ts` | 8 |
| `src/components/settings/TeamProfilesTab.tsx` | 8 |
| `src/components/instagram/InstagramLogsTab.tsx` | 8 |
| `src/lib/permissionsCatalog.ts` | 7 |
| `src/hooks/useSmartLabels.ts` | 7 |
| `src/components/crm/settings/ConversationEvalConfigCard.tsx` | 7 |
| `src/components/crm/LeadRotationConfig.tsx` | 7 |
| `src/components/crm/ContactsPane.tsx` | 7 |
| `src/components/crm/ContactDetailPane.tsx` | 7 |
| `src/components/admin/billing/BillingDashboardTab.tsx` | 7 |

**+208 outras** distribuídas em ~50 arquivos.

---

## Recomendação

### P0 — Corrigir antes do handoff

- **313 ocorrências de `text-[Xpx]`** (todos ≤11px) — quebra de a11y e legibilidade. Sugestão de varredura global:
  - `text-[10px]` e `text-[11px]` → `text-xs` (12px) na maior parte dos badges/contadores.
  - `text-[9px]` e `text-[8px]` → revisar layout (na maioria dos casos o container precisa de mais espaço, não de fonte menor).
  - **Concentrar em Dashboard (26), OpenBotConfigCard (15), FlowExecutionLogs (12)** — 17% do total em 3 arquivos.

### P1 — Próxima onda

- **318 cores Tailwind cruas** — mapear para tokens semânticos:
  - `*-emerald-*` / `*-green-*` (status ok) → `success` / `success-foreground` / `success/15`
  - `*-amber-*` / `*-yellow-*` (atenção) → `warning` / `warning-foreground`
  - `*-red-*` / `*-rose-*` (erro) → `destructive`
  - `*-purple-*` / `*-fuchsia-*` (IA/insights) → criar token semântico `ai` ou usar `accent`
  - **Priorizar flow nodes** (TriggerNode 17, TriggerConfigDialog 13, FlowNodeSidebar 11, VoiceCallNode 10, ConditionNode 9) — 60+ ocorrências em 5 arquivos.
- **~30 emojis substituíveis** por ícones Lucide nos arquivos não-intencionais (toasts de Auth/Flows/Rules, dicas de InstagramAutomationEditor/VoiceCallDialog, warnings de FlowsConfigCard/DeleteAllConversationsDialog).

### P2 — Débito conhecido

- **`<button>` HTML em ~12 lugares** após excluir os legítimos. Migrar Dashboard accordion-headers (6×) para `<Collapsible>` do shadcn na próxima refatoração de Dashboard.
- **3 fallbacks inline de cor** (`"#71717a"`, `rgba(255,255,255,0.08)`) — substituir por tokens HSL.
- **428 `any` TypeScript** — escopo de auditoria de código, não bloqueia handoff de UI. Endereçar progressivamente, priorizando AdminAffiliates (29), AdminNotifications (18), FlowEditor (18).

### Exceções legítimas (documentadas)

| Arquivo | Razão |
|---------|-------|
| `src/lib/provider-colors.ts` | Cores de marca de provedores externos (Kiwify/Hotmart/Eduzz) |
| `src/components/crm/EmojiPicker.tsx` | Catálogo de emojis (conteúdo, não chrome) |
| `src/components/affiliates/AffiliateCopyTemplates.tsx` | Templates de copy enviados a redes sociais |
| `src/components/lia/GuidedOverlay.tsx` (4× rgba) | Overlay spotlight com 4 lados — exigência técnica |
| `src/components/landing/LandingFooter.tsx`, `LandingHeader.tsx` | Gradientes de marca da landing |
| `src/lib/errorMessages.ts` | Não é UI |
| File inputs ocultos (`ChatPane`, `ContactImportTab`) | Padrão correto para file pickers programáticos |

---

**Total de arquivos modificados nesta auditoria:** 1 (este relatório). Nenhum código foi alterado.
