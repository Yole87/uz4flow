# Prospect Webhook: filter known meta fields from extracted lead data

## Objective
Update `supabase/functions/prospect-webhook/index.ts` so that `extractFieldData` skips the Elementor/WordPress meta fields that are sent as flat keys in `application/x-www-form-urlencoded` payloads. Keep the real form fields (e.g., `nome`, `whatsapp`, `email`) with their decoded keys and values.

## Current state
- `extractFieldData` already skips the `meta` object key and nested objects/arrays.
- For form-encoded submissions, the Elementor form plugin sends meta fields as flat keys alongside the real fields (e.g., `Data`, `Horário`, `URL da página`, `Agente de usuário`, `IP remoto`, `Desenvolvido por`, `form_id`, `form_name`, `URL+da+p`).
- These meta fields are currently being copied into `prospect_leads.field_data`.

## Proposed changes
1. Define a skip set in `extractFieldData` with the keys to ignore:
   - `Data`
   - `Horário`
   - `URL da página`
   - `Agente de usuário`
   - `IP remoto`
   - `Desenvolvido por`
   - `form_id`
   - `form_name`
   - `URL+da+p`
2. In the flat-object branch (Format 2 / 3), check the decoded key against the skip set before copying it into `field_data`.
3. Leave the Elementor Pro array format branch unchanged; it continues to use `field.id` as the key.
4. Keep the `URLSearchParams` parsing unchanged; percent-decoding is handled by `parseRequestBody`.

## Tests
Update `supabase/functions/prospect-webhook/index_test.ts` to export `extractFieldData` and add a test that verifies:
- A form-encoded payload with mixed real and meta fields returns only the real fields.
- A JSON payload with the same meta keys as flat fields is also filtered.
- Existing tests continue to pass.

## Deployment
Deploy `prospect-webhook` via the edge-function deployment tool after the code and tests are updated.

## Out of scope
- No changes to webhook token validation.
- No changes to database schema or RLS.
- No changes to the UI.
