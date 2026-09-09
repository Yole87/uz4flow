# Aplicar migration de colunas de exit step em uz_form_steps

## Objetivo
Aplicar a migration `20260909170000_uz_form_steps_exit.sql` que foi adicionada via GitHub, adicionando colunas de passo de saída à tabela `public.uz_form_steps`.

## SQL a executar
```sql
ALTER TABLE public.uz_form_steps
  ADD COLUMN IF NOT EXISTS is_exit_step BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exit_ending_type TEXT,
  ADD COLUMN IF NOT EXISTS exit_ending_message TEXT,
  ADD COLUMN IF NOT EXISTS exit_ending_whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS exit_ending_whatsapp_message TEXT,
  ADD COLUMN IF NOT EXISTS exit_purchase_products JSONB,
  ADD COLUMN IF NOT EXISTS exit_calendar_include_meet BOOLEAN NOT NULL DEFAULT false;
```

## Confirmação pós-execução
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'uz_form_steps'
  AND (column_name LIKE 'exit%' OR column_name = 'is_exit_step');
```

## Notas
- Nenhum código-fonte será alterado.
- A tabela já existe, portanto não é necessário novo GRANT.
- As colunas `is_exit_step` e `exit_calendar_include_meet` terão valor padrão `false` para registros existentes.
