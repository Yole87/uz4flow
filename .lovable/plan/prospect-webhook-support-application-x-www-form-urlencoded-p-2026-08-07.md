# Prospect Webhook: support `application/x-www-form-urlencoded` payloads

## Objective
Make `supabase/functions/prospect-webhook/index.ts` parse incoming webhooks correctly when they are sent as `application/x-www-form-urlencoded`, instead of always expecting JSON.

## Current state
The request body section does `const rawText = await req.text()` followed by `body = JSON.parse(rawText)` unconditionally. If a form/WordPress plugin posts form-encoded data, this throws a parse error and returns 400.

## Proposed changes
1. **Inspect the `Content-Type` header** after reading `rawText`.
2. **If the header includes `application/x-www-form-urlencoded`**:
   - Parse with `new URLSearchParams(rawText)`.
   - Convert the entries into a flat object: `{ [key]: value }` so downstream `extractFieldData` works.
3. **Otherwise** keep the existing `JSON.parse(rawText)` behavior for JSON payloads (including Elementor Pro format).
4. **Type safety**: update the `ElementorBody` type usage so the body variable can hold either a parsed JSON object or the flat form-encoded object. Keep the extraction logic unchanged.
5. **Error handling**: preserve the existing empty-body and payload-size guards; return the same JSON parse error for malformed payloads.
6. **Deployment**: run the edge function deployment for `prospect-webhook` after the code change.

## Out of scope
- No database schema or RLS changes.
- No changes to the webhook token validation flow.
- No new UI work.

## Tests
Add a Deno test file in `supabase/functions/prospect-webhook/index_test.ts` covering:
- JSON body (Elementor Pro format) still works.
- `application/x-www-form-urlencoded` body is parsed into field data.
- Malformed JSON still returns 400.

## Acceptance criteria
- `prospect-webhook` accepts `application/x-www-form-urlencoded` POSTs and stores the parsed fields in `prospect_leads.field_data`.
- JSON POSTs continue to work unchanged.
- Function is deployed and active.
