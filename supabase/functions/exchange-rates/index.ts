/**
 * exchange-rates — TC de Publicación DOF USD/EUR → MXN (Art. 20 CFF).
 *
 * v13.166.0: reescrito para reemplazar Frankfurter.app por la API SIE de Banxico.
 * v13.205.4: (revertido) probamos SF60653, pero esa serie es "Para Pagos" (SAT),
 *            no la Publicación DOF que exige el SAT para CFDI.
 * v13.205.5: se corrige la fuente. La Publicación DOF de HOY es literalmente el
 *            FIX del último día hábil ANTERIOR a hoy (misma serie SF43718, sólo
 *            cambia la fecha que tomas). Antes usábamos `datos/oportuno`, que
 *            a partir de las ~12:00 hrs devuelve el FIX de hoy (= DOF de mañana)
 *            y no cuadra con el DOF vigente. Ahora consultamos un rango de los
 *            últimos 10 días y seleccionamos explícitamente la última fila con
 *            fecha < hoy vía `extraerPublicacionDof`.
 *
 * Series consultadas en paralelo:
 *   - SF43718 → USD/MXN FIX (fecha = día hábil anterior = Publicación DOF de hoy)
 *   - SF46410 → EUR/MXN determinado por Banxico (mismo criterio de fecha)
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
const RANGO_DIAS = 10; // cubre fines de semana y feriados

const SERIE_USD = "SF43718"; // FIX/DOF USD — la Publicación DOF de hoy es esta serie con fecha=ayer hábil
const SERIE_EUR = "SF46410";

interface BanxicoDato { fecha: string; dato: string }
interface BanxicoResponse {
  bmx?: { series?: Array<{ idSerie?: string; datos?: BanxicoDato[] }> };
}

/**
 * Extrae el último dato numérico válido de la serie (compat: se conserva para
 * tests previos y consumidores que necesiten "el más reciente sin filtrar").
 * NO usar para CFDI: puede devolver el FIX de HOY, que es DOF de mañana.
 */
export function extraerUltimoTC(data: BanxicoResponse): number | null {
  const datos = data?.bmx?.series?.[0]?.datos ?? [];
  for (let i = datos.length - 1; i >= 0; i--) {
    const num = Number(datos[i]?.dato);
    if (Number.isFinite(num) && num > 0) return +num.toFixed(4);
  }
  return null;
}

/**
 * Selecciona el valor de "Publicación DOF vigente para `hoyIso`" desde una
 * respuesta de rango de SF43718/SF46410:
 *   - recorre de más nuevo a más viejo,
 *   - ignora "N/E" y no numéricos,
 *   - **descarta filas con fecha >= hoy** (esas son FIX de hoy o futuros,
 *     que serán DOF mañana o después),
 *   - devuelve el primer valor que queda.
 *
 * `hoyIso` debe venir en formato `YYYY-MM-DD`. Las filas de Banxico usan
 * `DD/MM/YYYY`; se normalizan aquí para comparar como strings ISO.
 */
export function extraerPublicacionDof(data: BanxicoResponse, hoyIso: string): number | null {
  const datos = data?.bmx?.series?.[0]?.datos ?? [];
  for (let i = datos.length - 1; i >= 0; i--) {
    const fila = datos[i];
    const partes = (fila?.fecha ?? "").split("/");
    if (partes.length !== 3) continue;
    const [dd, mm, yyyy] = partes;
    const filaIso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    if (filaIso >= hoyIso) continue; // FIX de hoy o futuros → no son DOF de hoy
    const num = Number(fila.dato);
    if (Number.isFinite(num) && num > 0) return +num.toFixed(4);
  }
  return null;
}

/**
 * Formatea `Date` como `YYYY-MM-DD` (formato ISO que exige el endpoint de rango
 * de Banxico SIE, `/datos/{fechaInicio}/{fechaFin}`). Usa componentes UTC.
 */
export function formatFechaBanxico(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

/** Devuelve el rango `{inicio, fin}` de los últimos `RANGO_DIAS` días para consulta SIE. */
export function rangoUltimosDias(hoy: Date, dias: number = RANGO_DIAS): { inicio: string; fin: string } {
  const fin = hoy;
  const inicio = new Date(hoy);
  inicio.setUTCDate(inicio.getUTCDate() - dias);
  return { inicio: formatFechaBanxico(inicio), fin: formatFechaBanxico(fin) };
}

let cache: { rates: { usdMxn: number; eurMxn: number }; expiresAt: number } | null = null;

/**
 * Fetch USD DOF: consulta un rango en SF43718 y selecciona el FIX del día
 * hábil anterior a hoy (= Publicación DOF vigente).
 */
async function fetchUsdDof(token: string, signal: AbortSignal, hoy: Date): Promise<number | null> {
  const { inicio, fin } = rangoUltimosDias(hoy);
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${SERIE_USD}/datos/${inicio}/${fin}`;
  const res = await fetch(url, {
    headers: { "Bmx-Token": token, "Accept": "application/json" },
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`banxico ${SERIE_USD} ${res.status}: ${body.slice(0, 200)}`);
  }
  const hoyIso = hoy.toISOString().slice(0, 10);
  return extraerPublicacionDof((await res.json()) as BanxicoResponse, hoyIso);
}

/**
 * Fetch EUR: SF46410 no soporta el endpoint de rango (404), sólo `oportuno`.
 * Para EUR el SAT no exige "Publicación DOF" formal (Art. 20 CFF trata USD);
 * la tasa Banxico vigente es aceptable para conversión en CFDI.
 */
async function fetchEurBanxico(token: string, signal: AbortSignal): Promise<number | null> {
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${SERIE_EUR}/datos/oportuno`;
  const res = await fetch(url, {
    headers: { "Bmx-Token": token, "Accept": "application/json" },
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`banxico ${SERIE_EUR} ${res.status}: ${body.slice(0, 200)}`);
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
  const hoy = new Date();

  try {
    const [usdMxn, eurMxn] = await Promise.all([
      fetchUsdDof(token, ctrl.signal, hoy),
      fetchEurBanxico(token, ctrl.signal),
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
