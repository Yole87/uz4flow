## Correções

**1. Remover badge duplicado no header do chat**
- Arquivo: `src/components/crm/ChatPane.tsx`
- Remover o `<StorageUsageBadge />` (linha ~652) e seu import
- O badge continua aparecendo no topo da página via `StorageHeaderBar`

**2. Tornar erros do som de notificação visíveis**
- Arquivo: `src/hooks/useNotificationSound.ts`
- No `testSound()` (botão 🔊): trocar `.catch(() => {})` por `.catch((err) => toast.error(\`Não foi possível tocar: ${err.message}\`))` e chamar `audio.load()` antes do play
- O `playNotification()` (automático) continua silencioso para não poluir
- Assim, ao clicar no botão de teste, sabemos exatamente o motivo da falha (bloqueio do navegador, arquivo inválido, etc.)
