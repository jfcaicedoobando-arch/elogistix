/**
 * banxico-tipo-cambio — obtiene el tipo de cambio DOF publicado por Banxico
 * vía API SIE (Sistema de Información Económica).
 *
 * Series:
 *  - SF43718 → USD/MXN FIX (para obligaciones en moneda extranjera, Art. 20 CFF)
 *  - SF46410 → EUR/MXN determinado por Banxico
 *
 * Uso: `GET /banxico-tipo-cambio?moneda=USD` → `{ tipoCambio, fecha, serie }`
 *
 * Requiere secret `BANXICO_SIE_TOKEN` (token gratuito del portal SIE).
 */
import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createLogger } from "../_shared/logger.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

const FETCH_TIMEOUT_MS = 5000;

const SERIES: Record<string, string> = {
  USD: "SF43718",
  EUR: "SF46410",
};

interface BanxicoDato { fecha: string; dato: string }
interface BanxicoResponse {
  bmx?: { series?: Array<{ idSerie?: string; datos?: BanxicoDato[] }> };
}

/** Parses "dd/mm/yyyy" → ISO "yyyy-mm-dd". */
export function parseFechaDOF(fecha: string): string {
  const [dd, mm, yyyy] = fecha.split("/");
  return `${yyyy}-${mm?.padStart(2, "0")}-${dd?.padStart(2, "0")}`;
}

/** Extrae el último dato numérico válido de la respuesta Banxico. */
export function extraerUltimoTC(data: BanxicoResponse): { tipoCambio: number; fecha: string } | null {
  const serie = data?.bmx?.series?.[0];
  const datos = serie?.datos ?? [];
  // Recorre de más reciente a más antiguo por si el último es "N/E".
  for (let i = datos.length - 1; i >= 0; i--) {
    const raw = datos[i]?.dato;
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) {
      return { tipoCambio: +num.toFixed(4), fecha: parseFechaDOF(datos[i].fecha) };
    }
  }
  return null;
}

Deno.serve(wrapEdgeHandler("banxico-tipo-cambio", async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const log = createLogger(req, "banxico-tipo-cambio");
  const url = new URL(req.url);
  const moneda = (url.searchParams.get("moneda") ?? "USD").toUpperCase();
  const serie = SERIES[moneda];

  if (!serie) {
    log.finish(400, "moneda_no_soportada", { payload: { moneda } });
    return jsonResponse({ error: `Moneda no soportada: ${moneda}. Usa USD o EUR.` }, 400);
  }

  const token = Deno.env.get("BANXICO_SIE_TOKEN");
  if (!token) {
    log.finish(500, "token_faltante");
    return jsonResponse({ error: "BANXICO_SIE_TOKEN no configurado" }, 500);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${serie}/datos/oportuno`,
      {
        headers: { "Bmx-Token": token, "Accept": "application/json" },
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`banxico ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as BanxicoResponse;
    const parsed = extraerUltimoTC(data);
    if (!parsed) {
      log.finish(502, "sin_datos_validos");
      return jsonResponse({ error: "Banxico no devolvió un valor válido" }, 502);
    }

    log.finish(200, "tc_ok", { payload: { moneda, serie, ...parsed } });
    return jsonResponse({ ...parsed, serie, moneda });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("banxico-tipo-cambio error:", message);
    log.finish(502, "banxico_error", { payload: { error: message } });
    return jsonResponse({ error: message }, 502);
  } finally {
    clearTimeout(timer);
  }
}));
