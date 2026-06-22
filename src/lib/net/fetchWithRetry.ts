/**
 * fetchWithRetry: wrapper resiliente sobre `fetch` con:
 * - Timeout vía AbortController (default 60s).
 * - Reintentos automáticos (default 3 intentos: original + 2 retries).
 * - Backoff progresivo (default 1s, 3s).
 * - Sólo reintenta errores transitorios: TypeError "Failed to fetch",
 *   AbortError por timeout, y respuestas 408/429/5xx.
 * - Permite construir el `RequestInit` por intento (vital cuando el body
 *   es un FormData con un File, ya que el stream se consume al enviar).
 */

export interface FetchRetryOptions {
  /** Timeout por intento individual. Default 60000ms. */
  timeoutMs?: number;
  /** Número total de intentos (incluyendo el primero). Default 3. */
  maxAttempts?: number;
  /** Pausa antes de cada reintento. Default [1000, 3000]. */
  backoffMs?: number[];
  /** Callback opcional notificado en cada reintento (para Sentry breadcrumbs, logs). */
  onRetry?: (info: { attempt: number; reason: string }) => void;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const DEFAULT_BACKOFF = [1000, 3000];

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError") return true;
  if (err.name === "TypeError" && /failed to fetch|network/i.test(err.message)) return true;
  return false;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchWithRetry(
  url: string,
  initOrBuilder: RequestInit | (() => RequestInit),
  opts: FetchRetryOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const maxAttempts = opts.maxAttempts ?? 3;
  const backoff = opts.backoffMs ?? DEFAULT_BACKOFF;
  const buildInit = typeof initOrBuilder === "function" ? initOrBuilder : () => initOrBuilder;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const init = buildInit();
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);

      if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt === maxAttempts) {
        return res;
      }
      // 5xx/408/429 con intentos restantes → retry.
      opts.onRetry?.({ attempt, reason: `http_${res.status}` });
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const transient = isTransientError(err);
      if (!transient || attempt === maxAttempts) {
        throw err;
      }
      opts.onRetry?.({
        attempt,
        reason: err instanceof Error ? `${err.name}:${err.message}` : "unknown",
      });
    }

    const pause = backoff[attempt - 1] ?? backoff[backoff.length - 1] ?? 1000;
    await sleep(pause);
  }
  // Inalcanzable, pero TS lo exige.
  throw lastErr ?? new Error("fetchWithRetry: agotó intentos");
}
