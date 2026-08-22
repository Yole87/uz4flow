# Pull latest from GitHub and publish

## Current state
- Local branch `edit/edt-ff54a041-12dc-4056-81a6-3c1f05b4ecad` is at commit `20e6967` ("Work in progress").
- `origin/main` HEAD is at `e7cec5c`, so the local branch is **1 commit ahead** of GitHub. There is nothing new to pull from the remote.
- Recent local edits introduced TypeScript build errors that block publication.

## Action plan

1. **Attempt Git pull**
   - Run `git pull origin main` to confirm there are no remote changes to merge.
   - If the local "Work in progress" commit is unpushed, leave it in place (it contains the user's latest changes).

2. **Fix build errors**
   The following TypeScript errors must be resolved before publishing:
   - `BaseFormulariosLayout.tsx:219` — `deleted_at` is not declared on `ProspectSource`. Add `deleted_at?: string | null` to `src/types/prospect.ts` or remove the reference.
   - `LeadsTable.tsx:798` — Checkbox `checked` prop receives an empty string `""`. Ensure the value is a boolean or `"indeterminate"`, never `""`.
   - `UzFormEditor.tsx:308` — Missing `Badge` import. Import `Badge` from the component library (`@/components/ui/badge`).

3. **Verify build**
   - Run `bun run build` (or `npm run build`) and confirm zero errors.

4. **Security scan check**
   - Run `security--run_security_scan` and review results.
   - If only warnings remain, proceed to publish. If new critical findings appear, stop and report them.

5. **Publish**
   - Call `preview_ui--publish` to deploy the frontend.
   - Confirm the published URL and estimated live time.

## Out of scope
- No database migrations.
- No new features.
- No security fixes beyond what is required to clear the publish gate.
