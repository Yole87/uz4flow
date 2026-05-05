/**
 * fetchWithRetry — wraps fetch with retries on transient HTTP errors.
 *
 * Behavior:
 *  - Retries on 5xx and 429 responses
 *  - Returns 4xx (other than 429) and 2xx/3xx immediately
 *  - Retries on network errors thrown by fetch
 *  - Honors AbortSignal: AbortError is rethrown immediately, never swallowed
 *  - Linear backoff: delay * (attempt + 1)
 */
export interface FetchRetryConfig {
  retries?: number;
  delay?: number;
}

export async function fetchWithRetry(
  url: string | URL,
  options: RequestInit = {},
  config: FetchRetryConfig = {}
): Promise<Response> {
  const retries = config.retries ?? 3;
  const delay = config.delay ?? 300;
  let lastError: unknown = null;

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);

      if (res.ok) return res;

      // Retry only on transient errors
      if (res.status >= 500 || res.status === 429) {
        lastError = new Error(`HTTP ${res.status}`);
        // try to drain body to free resources before retrying
        try { await res.body?.cancel(); } catch { /* ignore */ }
      } else {
        // Non-retryable client error — return as-is
        return res;
      }
    } catch (err) {
      // Never swallow aborts/timeouts
      if (err instanceof Error && err.name === "AbortError") {
        throw err;
      }
      lastError = err;
    }

    // Backoff before next attempt (skip on last loop)
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("fetchWithRetry exhausted");
}
