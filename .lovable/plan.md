## Problema identificado

No executor `supabase/functions/instagram-process-event/index.ts`, quando o trigger é **comentário** e o `send_dm` é enviado via **Private Reply** (a única chance fora da janela de DM), o código:

1. Marca `_private_reply_used = true` e `_awaiting_inbound_dm = true`
2. Salva o contexto na sessão **mas não avança `current_step_index`**
3. **Não retorna** — o `for` loop continua para os passos seguintes na mesma invocação

Como o Meta NÃO abre a janela de mensagens automaticamente depois do private reply (só abre quando o usuário responde a DM), os próximos passos (`ask_and_wait`, `check_follower`, `save_lead`, `tag_lead`, segundo `send_dm`) executam fora de hora: alguns falham silenciosamente, outros disparam erro de "messaging window closed", e o índice da sessão fica desalinhado — por isso "só funciona até enviar a DM".

A lógica correta já existe no branch `mustWaitForInboundDm` (linhas 1678-1710) e no `ask_and_wait` (linhas 1842-1873): persistir sessão aguardando e retornar. O branch de sucesso do private_reply em `send_dm` simplesmente não faz isso.

## Correção

### 1. `supabase/functions/instagram-process-event/index.ts` — `case "send_dm"` (linha ~1715)

No bloco `if (needsPrivateReply)`, quando `res.ok`:

- Persistir sessão aguardando com `currentStepIndex = i + batchedStepCount + 1` (próximo passo após o batch) usando `persistWaitingSession`
- Logar sucesso do `send_dm` (e dos passos batched)
- Marcar evento como `processed`, incrementar `execution_count`
- **Retornar imediatamente** com `{ processed: true, waiting: true, deferred: true, reason: "awaiting_inbound_dm" }`

Isso espelha exatamente o tratamento já feito em `mustWaitForInboundDm` e em `ask_and_wait` deferido.

### 2. Garantir consistência para fluxos futuros

Aplicar o mesmo princípio em qualquer outro ponto que envie via private_reply sem janela aberta:
- Verificar `case "ask_and_wait"` (já correto: defere quando Meta responde "window closed", mas falta pausar **antes** mesmo em sucesso de private_reply para esperar inbound antes do próximo passo). Ajuste: após `askNeedsPrivateReply` com `res.ok`, também persistir + retornar (igual ao send_dm), pois `ask_and_wait` por natureza já espera resposta — o flow não pode continuar avançando passos no mesmo run.

### 3. Validação após o deploy

- Refazer o teste: comentar em post → confirmar que chega a Private Reply
- Responder a DM → verificar nos logs `[IG-Process] Resuming session ... stepIndex=N+1` e que os passos seguintes (`check_follower`, `ask_and_wait`, `tag_lead`, `save_lead`, próximo `send_dm`) executam em sequência

## Resultado esperado

Toda automação cujo trigger é comentário passará a:
1. Enviar a Private Reply (já funciona)
2. **Pausar** aguardando o usuário responder na DM
3. Quando o usuário responder, **retomar do próximo passo** e executar o restante completo (verificar seguidor, perguntar, salvar lead, taguear, enviar próximas DMs etc.)

Vale para essa automação e qualquer futura — a correção é no motor central, não em uma automação específica.