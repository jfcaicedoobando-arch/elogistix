/**
 * exchange-rates — TC de Publicación DOF USD/EUR → MXN (Art. 20 CFF).
 *
 * v13.166.0: reemplaza Frankfurter.app por la API SIE de Banxico.
 * v13.205.5: la Publicación DOF de HOY es el FIX (SF43718) del último día hábil
 *            ANTERIOR a hoy; se consulta un rango de 10 días y se filtra.
 * v13.303.44 (FIX-10): el fallback nunca se usa en flujos fiscales.
 * v13.335.0: la lógica de Banxico vive en `_shared/banxicoDof.ts` (compartida
 *            con el cron `tc-dof-diario`) y ahora se lee PRIMERO la tabla
 *            interna `tipos_cambio_dof`; sólo si el día no está registrado se
 *            llama a Banxico.
 *
 * Contrato de respuesta invariante: `{ usdMxn, eurMxn }`.
 */
// @ts-expect-error Deno remote import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createLogger } from "../_shared/logger.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import {
  extraerPublicacionDof as dofPublicacion,
  extraerUltimoTC as ultimoTC,
  fetchEurBanxico,
  fetchUsdDof,
  formatFechaBanxico,
  rangoUltimosDias as rangoDias,
  type BanxicoResponse,
} from "../_shared/banxicoDof.ts";

/**
 * FIX-10 (auditoría): el fallback jamás debe presentarse como TC "real". Los
 * consumidores fiscales (facturas, NCs, pagos) deben rechazar `es_fallback:
 * true`. Se mantienen 17.25/18.5 sólo para cálculos operativos no fiscales.
 */
export const FALLBACK = { usdMxn: 17.25, eurMxn: 18.5, es_fallback: true } as const;
const FETCH_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 h
const CACHE_TTL_HISTORICO_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// Re-exports para compatibilidad con tests y consumidores previos.
export function extraerUltimoTC(data: BanxicoResponse): number | null {
  return ultimoTC(data);
}
export function extraerPublicacionDof(data: BanxicoResponse, hoyIso: string): number | null {
  return dofPublicacion(data, hoyIso).tc;
}
export { formatFechaBanxico };
export function rangoUltimosDias(hoy: Date, dias?: number) {
  return rangoDias(hoy, dias);
}


interface Rates {
  usdMxn: number;
  eurMxn: number;
  fechaAplicada?: string;
  es_fallback?: false;
  origen?: "tabla" | "banxico";
}

let cacheHoyRef: { rates: Rates; expiresAt: number } | null = null;
const cacheHistorico = new Map<string, { rates: Rates; expiresAt: number }>();

/**
 * Extrae la fecha objetivo: query string (`?fecha=YYYY-MM-DD`) y como fallback
 * el body JSON `{ fecha }` (para `supabase.functions.invoke`).
 */
export async function resolverFecha(req: Request): Promise<{ fecha: Date; esHoy: boolean; key: string; fechaIso: string }> {
  const hoy = new Date();
  // FIX-12 · `toISOString()` da el día en UTC — a las 19:00 CDMX ya es "mañana".
  const hoyIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(hoy);
  const url = new URL(req.url);
  let raw = url.searchParams.get("fecha") ?? "";
  if (!raw && req.method === "POST") {
    try {
      const body = await req.clone().json();
      if (body && typeof body.fecha === "string") raw = body.fecha;
    } catch { /* body no era JSON o vacío */ }
  }
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw >= hoyIso) {
    // N14 (Ola 4): fechaIso es SIEMPRE el día civil MX — única llave válida
    // para tipos_cambio_dof y coherente con el corte de la Publicación DOF.
    return { fecha: hoy, esHoy: true, key: "hoy", fechaIso: hoyIso };
  }
  const d = new Date(raw + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return { fecha: hoy, esHoy: true, key: "hoy", fechaIso: hoyIso };
  return { fecha: d, esHoy: false, key: raw, fechaIso: raw };
}

/**
 * N14 (Ola 4): milisegundos hasta la próxima medianoche en America/Mexico_City.
 * Tope del caché de "hoy": el TC del día no puede sobrevivir al cambio de día
 * MX (el TTL fijo de 12 h servía el TC de ayer hasta media mañana siguiente).
 */
export function msHastaMedianocheMx(now: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const valor = (type: string) => Number(partes.find((p) => p.type === type)?.value ?? "0");
  const h = valor("hour") % 24;
  return ((23 - h) * 3600 + (59 - valor("minute")) * 60 + (60 - valor("second"))) * 1000;
}

/**
 * Lee el TC ya registrado por el cron en `tipos_cambio_dof`. Devuelve `null`
 * si no hay renglón para esa fecha (o si la consulta falla) para caer a Banxico.
 */
export async function leerTcDeTabla(fechaIso: string): Promise<Rates | null> {
  try {
    // @ts-expect-error Deno global
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    // @ts-expect-error Deno global
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return null;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin
      .from("tipos_cambio_dof")
      .select("fecha, usd_mxn, eur_mxn, fecha_publicacion_usd")
      .eq("fecha", fechaIso)
      .maybeSingle();
    if (error || !data) return null;
    const usdMxn = Number(data.usd_mxn);
    if (!Number.isFinite(usdMxn) || usdMxn <= 0) return null;
    const eur = Number(data.eur_mxn);
    return {
      usdMxn,
      eurMxn: Number.isFinite(eur) && eur > 0 ? eur : FALLBACK.eurMxn,
      fechaAplicada: data.fecha_publicacion_usd ?? undefined,
      es_fallback: false,
      origen: "tabla",
    };
  } catch {
    return null;
  }
}

Deno.serve(wrapEdgeHandler("exchange-rates", async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const log = createLogger(req, "exchange-rates");
  const { fecha, esHoy, key, fechaIso } = await resolverFecha(req);

  // Caché: "hoy" con TTL corto; históricas con TTL largo (son inmutables).
  if (esHoy && cacheHoyRef && cacheHoyRef.expiresAt > Date.now()) {
    log.finish(200, "rates_cache_hit_hoy", { payload: cacheHoyRef.rates });
    return jsonResponse(cacheHoyRef.rates);
  }
  if (!esHoy) {
    const hit = cacheHistorico.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      log.finish(200, "rates_cache_hit_historico", { payload: hit.rates });
      return jsonResponse(hit.rates);
    }
  }

  const guardarCache = (rates: Rates) => {
    if (esHoy) {
      // N14 (Ola 4): (1) no cachear durante la ventana de desfase UTC
      // (18:00–23:59 CST), cuando el día UTC ya es mañana; (2) el TTL nunca
      // cruza la medianoche MX.
      if (formatFechaBanxico(new Date()) !== fechaIso) return;
      const ttl = Math.min(CACHE_TTL_MS, msHastaMedianocheMx(new Date()));
      cacheHoyRef = { rates, expiresAt: Date.now() + ttl };
    }
    else cacheHistorico.set(key, { rates, expiresAt: Date.now() + CACHE_TTL_HISTORICO_MS });
  };

  // 1) Tabla interna alimentada por el cron `tc-dof-diario`.
  // N14 (Ola 4): llave MX — antes formatFechaBanxico(fecha) (UTC) consultaba
  // la tabla con la fecha de "mañana" entre 18:00 y 23:59 CST.
  const deTabla = await leerTcDeTabla(fechaIso);
  if (deTabla) {
    guardarCache(deTabla);
    log.finish(200, "rates_ok_tabla", { payload: deTabla });
    return jsonResponse(deTabla);
  }

  // 2) Banxico en vivo.
  // @ts-expect-error Deno global
  const token = Deno.env.get("BANXICO_SIE_TOKEN");
  if (!token) {
    console.warn("exchange-rates: BANXICO_SIE_TOKEN no configurado — usando fallback");
    log.finish(200, "rates_no_token_fallback", { payload: FALLBACK });
    return jsonResponse(FALLBACK);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    const [usd, eurMxn] = await Promise.all([
      fetchUsdDof(token, ctrl.signal, fecha),
      fetchEurBanxico(token, ctrl.signal, fecha, esHoy),
    ]);
    if (usd.tc == null) {
      log.finish(200, "rates_fallback_usd_missing", { payload: FALLBACK });
      return jsonResponse(FALLBACK);
    }
    const rates: Rates = {
      usdMxn: usd.tc,
      eurMxn: eurMxn ?? FALLBACK.eurMxn,
      fechaAplicada: usd.fechaAplicada,
      es_fallback: false,
      origen: "banxico",
    };
    guardarCache(rates);
    log.finish(200, esHoy ? "rates_ok_hoy" : "rates_ok_historico", { payload: rates });
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
