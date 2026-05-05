/**
 * Shared template interpolation helper for Edge Functions.
 *
 * Supports two syntaxes:
 *  - "curly":        {key}
 *  - "double_curly": {{key}}  (default)
 *
 * Behavior matches the legacy `renderTemplate` (curly) and `resolveTemplate`
 * (double_curly) helpers byte-for-byte on existing alphanumeric template keys.
 * Regex-key escaping is added as a safety net.
 */
export type TemplateSyntax = "curly" | "double_curly";

export function interpolateTemplate(
  template: string,
  vars: Record<string, unknown>,
  syntax: TemplateSyntax = "double_curly",
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars || {})) {
    const safeValue = String(value ?? "");
    const pattern =
      syntax === "curly"
        ? new RegExp(`\\{${escapeRegex(key)}\\}`, "g")
        : new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "g");
    out = out.replace(pattern, safeValue);
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
