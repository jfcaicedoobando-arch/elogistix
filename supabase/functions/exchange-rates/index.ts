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
 * Contrato de respuesta invariante: `{ usdMxn, eurMxn|null, eur_es_fallback? }`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createLogger } from "../_shared/logger.ts";
import { captureEdgeException, wrapEdgeHandler } from "../_shared/sentry.ts";
import { limitarPeticionesPublicas } from "../_shared/ratelimit.ts";
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
// R3 · P3: tope de entradas del caché histórico en memoria del aislado.
const MAX_CACHE_HISTORICO = 400;

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
  // RTC-01: index signature para poder pasar el objeto como `payload`
  // (Record<string, unknown>) del logger sin castear en cada callsite.
  [k: string]: unknown;
  usdMxn: number;
  // EF-04: null cuando la fuente no trae EUR — nunca el fallback 18.5
  // disfrazado de TC real (contrato FIX-10).
  eurMxn: number | null;
  fechaAplicada?: string;
  /** BL-16: fecha que pidió el cliente (null si no pidió ninguna válida). */
  fechaSolicitada?: string | null;
  es_fallback?: false;
  /** EF-04: true cuando el EUR no vino de Banxico/tabla (fallback parcial). */
  eur_es_fallback?: boolean;
  origen?: "tabla" | "banxico";
}

let cacheHoyRef: { rates: Rates; expiresAt: number } | null = null;
const cacheHistorico = new Map<string, { rates: Rates; expiresAt: number }>();

/**
 * BL-16: sella la fecha solicitada al momento de responder (NO se guarda en
 * caché: el mismo TC de "hoy" se sirve a peticiones con fechas distintas).
 */
function conFechaSolicitada<T extends Record<string, unknown>>(
  rates: T,
  fechaSolicitada: string | null,
): T & { fechaSolicitada: string | null } {
  return { ...rates, fechaSolicitada };
}


/**
 * Ola E1 · N23: `2023-02-31` pasaba el regex y `new Date()` la corría a marzo,
 * devolviendo el T/C de otro día como si fuera el pedido. Aquí validamos el
 * round-trip del día civil.
 */
export function esFechaCivilValida(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [y, m, d] = raw.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Extrae la fecha objetivo: query string (`?fecha=YYYY-MM-DD`) y como fallback
 * el body JSON `{ fecha }` (para `supabase.functions.invoke`).
 */
export async function resolverFecha(req: Request): Promise<{ fecha: Date; esHoy: boolean; key: string; fechaIso: string; fechaSolicitada: string | null; invalida: boolean }> {
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
  // N23: fecha capturada pero imposible (o mal formada) => 400, no silencio.
  if (raw && !esFechaCivilValida(raw)) {
    return { fecha: hoy, esHoy: true, key: "hoy", fechaIso: hoyIso, fechaSolicitada: null, invalida: true };
  }
  // BL-16: la fecha pedida se conserva SIEMPRE en la respuesta. Antes, pedir
  // una fecha futura devolvía el TC de hoy sin decir que se sustituyó.
  const solicitada = raw || null;
  if (!raw || raw >= hoyIso) {
    // N14 (Ola 4): fechaIso es SIEMPRE el día civil MX — única llave válida
    // para tipos_cambio_dof y coherente con el corte de la Publicación DOF.
    return { fecha: hoy, esHoy: true, key: "hoy", fechaIso: hoyIso, fechaSolicitada: solicitada, invalida: false };
  }
  const d = new Date(raw + "T12:00:00Z");
  return { fecha: d, esHoy: false, key: raw, fechaIso: raw, fechaSolicitada: raw, invalida: false };
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
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
    const eurValido = Number.isFinite(eur) && eur > 0;
    return {
      usdMxn,
      // EF-04: EUR ausente ⇒ null + flag; jamás FALLBACK.eurMxn con es_fallback:false.
      eurMxn: eurValido ? eur : null,
      fechaAplicada: data.fecha_publicacion_usd ?? undefined,
      es_fallback: false,
      eur_es_fallback: !eurValido,
      origen: "tabla",
    };
  } catch {
    return null;
  }
}

/** Lee el caché correspondiente (hoy con TTL corto, histórico inmutable). */
function buscarEnCache(esHoy: boolean, key: string): { rates: Rates; motivo: string } | null {
  if (esHoy) {
    if (cacheHoyRef && cacheHoyRef.expiresAt > Date.now()) {
      return { rates: cacheHoyRef.rates, motivo: "rates_cache_hit_hoy" };
    }
    return null;
  }
  const hit = cacheHistorico.get(key);
  if (hit && hit.expiresAt > Date.now()) return { rates: hit.rates, motivo: "rates_cache_hit_historico" };
  return null;
}

/** Guarda en caché respetando la ventana de desfase UTC y el tope de memoria. */
function guardarEnCache(rates: Rates, esHoy: boolean, key: string, fechaIso: string): void {
  if (esHoy) {
    // N14 (Ola 4): (1) no cachear durante la ventana de desfase UTC
    // (18:00–23:59 CST), cuando el día UTC ya es mañana; (2) el TTL nunca
    // cruza la medianoche MX.
    if (formatFechaBanxico(new Date()) !== fechaIso) return;
    const ttl = Math.min(CACHE_TTL_MS, msHastaMedianocheMx(new Date()));
    cacheHoyRef = { rates, expiresAt: Date.now() + ttl };
    return;
  }
  // R3 · P3: el Map vive en el aislado — tope de entradas para que un
  // atacante iterando fechas no infle la memoria (evicción FIFO).
  if (cacheHistorico.size >= MAX_CACHE_HISTORICO) {
    const primero = cacheHistorico.keys().next().value;
    if (primero !== undefined) cacheHistorico.delete(primero);
  }
  cacheHistorico.set(key, { rates, expiresAt: Date.now() + CACHE_TTL_HISTORICO_MS });
}

/**
 * v13.624.6 — Blindaje del contrato de respuesta.
 *
 * Antes, cualquier excepción fuera del `try` principal (p. ej. `resolverFecha`
 * con una URL/body raro, o el logger) escapaba del handler y salía como 500 sin
 * cuerpo ni CORS: los flujos fiscales quedaban sin respuesta. Ahora el handler
 * completo va dentro de un `try/catch` que reporta a Sentry y responde el
 * contrato invariante con `es_fallback: true` (que los consumidores fiscales ya
 * rechazan explícitamente), en vez de un 500 opaco.
 */
async function manejarExchangeRates(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const log = createLogger(req, "exchange-rates");
  const { fecha, esHoy, key, fechaIso, fechaSolicitada, invalida } = await resolverFecha(req);
  if (invalida) {
    log.finish(400, "fecha_invalida");
    return jsonResponse(
      { error: "fecha_invalida", mensaje: "La fecha debe existir y venir en formato AAAA-MM-DD." },
      400,
    );
  }
  const sellar = <T extends Record<string, unknown>>(r: T) => conFechaSolicitada(r, fechaSolicitada);


  const enCache = buscarEnCache(esHoy, key);
  if (enCache) {
    log.finish(200, enCache.motivo, { payload: enCache.rates });
    return jsonResponse(sellar(enCache.rates));
  }

  const guardarCache = (rates: Rates) => guardarEnCache(rates, esHoy, key, fechaIso);


  // 1) Tabla interna alimentada por el cron `tc-dof-diario`.
  // N14 (Ola 4): llave MX — antes formatFechaBanxico(fecha) (UTC) consultaba
  // la tabla con la fecha de "mañana" entre 18:00 y 23:59 CST.
  const deTabla = await leerTcDeTabla(fechaIso);
  if (deTabla) {
    guardarCache(deTabla);
    log.finish(200, "rates_ok_tabla", { payload: deTabla });
    return jsonResponse(sellar(deTabla));
  }

  // 2) Banxico en vivo — R3 · P3: endpoint PÚBLICO; sin freno, un atacante
  // iterando `?fecha=` distintas (que saltan el caché) agota la cuota del
  // token SIE. Rate limit persistente por IP + global (fail-CLOSED, patrón
  // EC-3 de _shared/ratelimit.ts) sólo en el camino que pega a Banxico: los
  // hits de caché y de tabla interna no se penalizan.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && serviceKey) {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const corte = await limitarPeticionesPublicas(admin, req, {
      fn: "exchange-rates",
      porIp: { windowSeconds: 60, max: 30 },
      global: { windowSeconds: 60, max: 300 },
    });
    if (corte) return corte;
  }

  const token = Deno.env.get("BANXICO_SIE_TOKEN");
  if (!token) {
    console.warn("exchange-rates: BANXICO_SIE_TOKEN no configurado — usando fallback");
    log.finish(200, "rates_no_token_fallback", { payload: FALLBACK });
    return jsonResponse(sellar(FALLBACK));
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
      return jsonResponse(sellar(FALLBACK));
    }
    const rates: Rates = {
      usdMxn: usd.tc,
      // EF-04: EUR ausente ⇒ null + flag; jamás FALLBACK.eurMxn con es_fallback:false.
      eurMxn: eurMxn ?? null,
      fechaAplicada: usd.fechaAplicada,
      es_fallback: false,
      eur_es_fallback: eurMxn == null,
      origen: "banxico",
    };
    guardarCache(rates);
    log.finish(200, esHoy ? "rates_ok_hoy" : "rates_ok_historico", { payload: rates });
    return jsonResponse(sellar(rates));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("exchange-rates fallback:", message);
    log.finish(200, "rates_fallback", { payload: { error: message, ...FALLBACK } });
    return jsonResponse(sellar(FALLBACK));
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(wrapEdgeHandler("exchange-rates", async (req) => {
  try {
    return await manejarExchangeRates(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ level: "error", fn: "exchange-rates", msg: "unhandled", error: message }));
    await captureEdgeException(err, { fn: "exchange-rates", status_code: 200 });
    return jsonResponse({ ...FALLBACK, fechaSolicitada: null });
  }
}));
