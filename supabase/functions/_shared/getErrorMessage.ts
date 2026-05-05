/**
 * getErrorMessage — safe extraction of an error message for internal logging.
 *
 * Never expose raw output to clients (may leak PII / stack info).
 * Use for `console.error` context strings, never as a client response body.
 */
export function getErrorMessage(err: unknown): string {
  if (err === null || err === undefined) return "Erro desconhecido";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || err.name || "Erro";
  try {
    return JSON.stringify(err);
  } catch {
    return "Erro inesperado";
  }
}
