# Plano de correção — funções públicas de agendamento e timezone

## Contexto
Foram identificados dois ajustes pontuais nas Edge Functions de agendamento do Google Calendar para garantir que formulários públicos consigam consultar horários e criar eventos sem JWT, e para padronizar o offset de fuso horário do Brasil.

Arquivos lidos:
- `supabase/config.toml`
- `supabase/functions/google-calendar-book/index.ts`

## Fix 1 — `verify_jwt = false` para funções públicas de booking

Arquivo: `supabase/config.toml`

O arquivo já possui o padrão:

```toml
[functions.prospect-webhook]
verify_jwt = false
```

Adicionar, logo após a entrada existente, as duas novas funções públicas de agendamento, mantendo o mesmo formato:

```toml
[functions.google-calendar-slots]
verify_jwt = false

[functions.google-calendar-book]
verify_jwt = false
```

## Fix 2 — Padronizar offset explícito -03:00 no `google-calendar-book`

Arquivo: `supabase/functions/google-calendar-book/index.ts`

Hoje o corpo do evento enviado ao Google Calendar API usa:

```ts
start: { dateTime: start_datetime, timeZone: "America/Sao_Paulo" },
end: { dateTime: endDatetime, timeZone: "America/Sao_Paulo" },
```

onde `endDatetime` é gerado com `.toISOString()` (offset Z).

Ajustes:
1. Criar helper `toBrazilISO(date: Date): string` que converte um `Date` para ISO com offset explícito `-03:00`.
2. Garantir que `endDatetime` seja um objeto `Date` antes de formatar.
3. Substituir as linhas do event body por:

```ts
start: { dateTime: toBrazilISO(parsedStart), timeZone: "America/Sao_Paulo" },
end: { dateTime: toBrazilISO(endDatetimeDate), timeZone: "America/Sao_Paulo" },
```

Isso alinha o comportamento com `google-calendar-slots`, que já usa offset fixo `-03:00`, e evita problemas de horário de verão.

## Verificação e commit

Após aplicar os dois fixes:

1. Executar `npx tsc --noEmit` para validar tipos.
2. Executar o commit:

```bash
git add . && git commit -m "fix: verify_jwt=false for public booking functions and standardize Brazil timezone offset"
```

Não fazer push — o usuário fará manualmente.
