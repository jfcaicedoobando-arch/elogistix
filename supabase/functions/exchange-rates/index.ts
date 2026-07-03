/**
 * exchange-rates — TC DOF USD/EUR → MXN publicado por Banxico (Art. 20 CFF).
 *
 * v13.166.0: reescrito para reemplazar Frankfurter.app por la API SIE de Banxico.
 * Series consultadas en paralelo:
 *   - SF43718 → USD/MXN FIX (para obligaciones en moneda extranjera)
 *   - SF46410 → EUR/MXN determinado por Banxico
 *
 * Caché in-memory 12 h para no agotar la cuota diaria del token.
 * Contrato de respuesta invariante: `{ usdMxn, eurMxn }`.
 */
import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createLogger } from "../_shared/logger.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

export const FALLBACK = { usdMxn: 17.25, eurMxn: 18.5 };
const FETCH_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 h

const SERIE_USD = "SF43718";
const SERIE_EUR = "SF46410";

interface BanxicoDato { fecha: string; dato: string }
interface BanxicoResponse {
  bmx?: { series?: Array<{ idSerie?: string; datos?: BanxicoDato[] }> };
}

/** Extrae el último dato numérico válido (ignora "N/E"). */
export function extraerUltimoTC(data: BanxicoResponse): number | null {
  const datos = data?.bmx?.series?.[0]?.datos ?? [];
  for (let i = datos.length - 1; i >= 0; i--) {
    const num = Number(datos[i]?.dato);
    if (Number.isFinite(num) && num > 0) return +num.toFixed(4);
  }
  return null;
}

let cache: { rates: { usdMxn: number; eurMxn: number }; expiresAt: number } | null = null;

async function fetchSerie(serie: string, token: string, signal: AbortSignal): Promise<number | null> {
  const res = await fetch(
    `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${serie}/datos/oportuno`,
    { headers: { "Bmx-Token": token, "Accept": "application/json" }, signal },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`banxico ${serie} ${res.status}: ${body.slice(0, 200)}`);
  }
  return extraerUltimoTC((await res.json()) as BanxicoResponse);
}

Deno.serve(wrapEdgeHandler("exchange-rates", async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const log = createLogger(req, "exchange-rates");

  // Caché en memoria — sobrevive entre invocaciones mientras la instancia esté caliente.
  if (cache && cache.expiresAt > Date.now()) {
    log.finish(200, "rates_cache_hit", { payload: cache.rates });
    return jsonResponse(cache.rates);
  }

  const token = Deno.env.get("BANXICO_SIE_TOKEN");
  if (!token) {
    console.warn("exchange-rates: BANXICO_SIE_TOKEN no configurado — usando fallback");
    log.finish(200, "rates_no_token_fallback", { payload: FALLBACK });
    return jsonResponse(FALLBACK);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    const [usdMxn, eurMxn] = await Promise.all([
      fetchSerie(SERIE_USD, token, ctrl.signal),
      fetchSerie(SERIE_EUR, token, ctrl.signal),
    ]);
    const rates = {
      usdMxn: usdMxn ?? FALLBACK.usdMxn,
      eurMxn: eurMxn ?? FALLBACK.eurMxn,
    };
    cache = { rates, expiresAt: Date.now() + CACHE_TTL_MS };
    log.finish(200, "rates_ok", { payload: rates });
    return jsonResponse(rates);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("exchange-rates fallback:", message);
    log.finish(200, "rates_fallback", { payload: { error: message, ...FALLBACK } });
    return jsonResponse(FALLBACK);
  } finally {
    clearTimeout(timer);
  }
}));
