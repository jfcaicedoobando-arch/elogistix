import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createLogger } from "../_shared/logger.ts";

export const FALLBACK = { usdMxn: 17.25, eurMxn: 18.5 };
const FETCH_TIMEOUT_MS = 5000;

/** Pure helper: derives usdMxn / eurMxn from a Frankfurter API response. */
export function computeRates(data: unknown): { usdMxn: number; eurMxn: number } {
  const d = data as { rates?: { USD?: number; EUR?: number } } | null;
  const usdMxn = d?.rates?.USD ? +(1 / d.rates.USD).toFixed(4) : FALLBACK.usdMxn;
  const eurMxn = d?.rates?.EUR ? +(1 / d.rates.EUR).toFixed(4) : FALLBACK.eurMxn;
  return { usdMxn, eurMxn };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const log = createLogger(req, "exchange-rates");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=MXN&to=USD,EUR",
      { signal: ctrl.signal },
    );
    if (!res.ok) throw new Error(`frankfurter ${res.status}`);
    const data = await res.json();
    const { usdMxn, eurMxn } = computeRates(data);

    log.finish(200, "rates_ok", { payload: { usdMxn, eurMxn } });
    return jsonResponse({ usdMxn, eurMxn });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("exchange-rates fallback:", message);
    log.finish(200, "rates_fallback", { payload: { error: message, ...FALLBACK } });
    return jsonResponse(FALLBACK);
  } finally {
    clearTimeout(timer);
  }
});
