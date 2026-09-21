/**
 * facturapiClient — Devuelve una instancia del SDK oficial `facturapi`
 * (v5.0.0) ya configurada para la organización dada.
 *
 * Carga el SDK vía import ESTÁTICO `npm:facturapi@5.0.0` y cachea el cliente
 * por API key para evitar reinstanciar en invocaciones encadenadas dentro de
 * la misma instancia del runtime.
 *
 * El ambiente (sandbox/live) se decide implícitamente por la API key que
 * `resolveFacturapiKey` entrega (cada secret apunta a su ambiente).
 *
 * Sólo este módulo puede importar `npm:facturapi`. Las edge functions deben
 * usar `getFacturapiClient(supabase, organizationId)`.
 *
 * Historial de versiones del SDK:
 * - v13.794.0: bump 4.18.0 → 4.20.0 (métodos `invoices.*ZipRequest` para la
 *   descarga ZIP mensual y fix de tipado `property_tax_account` como arreglo).
 * - bump 4.20.0 → 5.0.0 (18-sep-2026): los breaking changes de v5 son de
 *   TIPADO (`SearchResult<T>` con `page`/`total_pages`/`total_results`
 *   opcionales y retiro de `CursorSearchResult<T>`), más un fix de
 *   serialización de query params anidados. Esta capa tipa el cliente como
 *   objeto opaco y `facturapi-recuperar-claim` ya trata `total_pages` ausente
 *   como búsqueda "incierta", así que no hubo cambios de payload ni de flujo.
 *
 * NOTA: antes usábamos `import()` dinámico con la spec en variable
 * (`const sdkSpec = "npm:facturapi@5.0.0"; import(sdkSpec)`). Deno Edge
 * Runtime construye el grafo de paquetes npm SOLO a partir de imports
 * estáticos: al ser dinámico, el paquete no quedaba registrado y el boot
 * fallaba con `Could not find constraint 'facturapi@<versión>' in the list of
 * packages.`, tirando todo request con "Edge Function returned a non-2xx".
 */
// P2-C: el paquete `facturapi` SÍ publica typings (v5.0.0, `dist/*.d.ts`),
// pero están declarados para resolución de bundler/Node y el typecheck de Deno
// no los alcanza desde el especificador `npm:`. De ahí el `@ts-ignore` y el
// modelado como objeto opaco: la superficie tipada que usa el ERP vive en
// `_shared/facturapiSdk.ts` (un solo lugar con los casts del SDK).
// @ts-ignore -- typings del paquete no resolubles desde el especificador `npm:` en Deno.
import FacturapiDefault from "npm:facturapi@5.0.0";
import { resolveFacturapiKey, type FacturapiResolveResult, type SupabaseLike } from "./facturapiAuth.ts";
import { normalizarErrorFacturapi } from "./facturapiErrorNormalizado.ts";

export type FacturapiClient = object;

type FacturapiCtorType = new (apiKey: string) => FacturapiClient;

// Algunos empaquetados exponen el ctor como `default.default` (CJS/ESM interop).
// Normalizamos aquí para tener una sola forma de instanciarlo.
const RawDefault = FacturapiDefault as unknown as
  | FacturapiCtorType
  | { default?: FacturapiCtorType };
const FacturapiCtor: FacturapiCtorType =
  (typeof RawDefault === "function"
    ? RawDefault
    : (RawDefault?.default ?? (RawDefault as unknown as FacturapiCtorType)));

const clientCache = new Map<string, FacturapiClient>();

export interface FacturapiClientResolved {
  client: FacturapiClient;
  apiKey: string;
  ambiente: "sandbox" | "live";
  facturapiOrgId: string | null;
}

export type FacturapiClientResult =
  | { ok: true; data: FacturapiClientResolved }
  | { ok: false; data: Extract<FacturapiResolveResult, { ok: false }>["data"] };

/**
 * Resuelve la API key y devuelve un cliente del SDK listo para usarse.
 */
export async function getFacturapiClient(
  supabase: SupabaseLike,
  organizationId: string,
): Promise<FacturapiClientResult> {
  const resolved = await resolveFacturapiKey(supabase, organizationId);
  if (!resolved.ok) return { ok: false, data: resolved.data };

  const { apiKey, ambiente, facturapiOrgId } = resolved.data;

  let client = clientCache.get(apiKey);
  if (!client) {
    client = new FacturapiCtor(apiKey);
    clientCache.set(apiKey, client);
  }

  return {
    ok: true,
    data: { client, apiKey, ambiente, facturapiOrgId },
  };
}

interface FacturapiErrorShape {
  response?: { status?: number; data?: unknown };
  status?: number;
  data?: unknown;
  message?: string;
  // Campos planos expuestos por la clase `FacturapiError` del SDK desde
  // v4.18.0 y vigentes en v5.0.0 (no viven bajo `response.data`).
  code?: string;
  path?: string;
  location?: string;
  errors?: unknown;
  logId?: string;
}

export interface FacturapiErrorDetail {
  message: string;
  code?: string;
  path?: string;
  location?: string;
  errors?: unknown;
  logId?: string;
  raw?: unknown;
  /** P2-B: metadatos de diagnóstico/rate limiting (429). */
  requestId?: string;
  retryAfterSegundos?: number;
  rateLimited?: boolean;
  /** Mensaje en español listo para el operador (429/timeout incluidos). */
  mensajeUsuario?: string;
  /** Invariante: el timbrado NUNCA se reintenta automáticamente. */
  reintentoAutomatico?: false;
}

function pickStr(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

/**
 * Normaliza un error lanzado por el SDK de FacturApi a `{ status, detail }`
 * para responder al cliente con un shape consistente. Preserva `code`,
 * `path`, `location`, `errors[]` y `logId` que expone el SDK como campos
 * planos (desde v4.18.0, vigentes en v5.0.0) — antes se perdían al leer sólo
 * `response.data`.
 *
 * P2-B: además conserva `Retry-After`, el request id del proveedor y marca los
 * 429 con un mensaje accionable. El reintento del timbrado sigue siendo SIEMPRE
 * manual: reintentar solo un 429 arriesga CFDIs/REP duplicados.
 */
export function describeFacturapiError(err: unknown): { status: number; detail: FacturapiErrorDetail } {
  const e = (err ?? {}) as FacturapiErrorShape;
  const norm = normalizarErrorFacturapi(err);
  const base = ((e.response?.data ?? e.data ?? {}) as Record<string, unknown>);
  const detail: FacturapiErrorDetail = {
    message: pickStr(base.message, e.message) ?? String(err),
    code: pickStr(base.code, e.code),
    path: pickStr(base.path, e.path),
    location: pickStr(base.location, e.location),
    errors: base.errors ?? e.errors,
    logId: pickStr(base.logId, e.logId) ?? norm.logId,
    requestId: norm.requestId,
    retryAfterSegundos: norm.retryAfterSegundos,
    rateLimited: norm.rateLimited,
    mensajeUsuario: norm.mensajeUsuario,
    reintentoAutomatico: false,
  };
  return { status: norm.status, detail };
}


/**
 * Extrae un `message` humano del `detail` que devuelve FacturApi (o el fallback
 * genérico). Se comparte entre los handlers de edge functions para no repetir
 * el ternario denso `detail && typeof === "object" && "message" in ...` que
 * dispara la complejidad ciclomática de ESLint.
 */
export function extractFacturapiMessage(detail: unknown, status: number | string): string {
  if (detail && typeof detail === "object" && "message" in (detail as Record<string, unknown>)) {
    const m = (detail as Record<string, unknown>).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return `FacturApi respondió ${status}`;
}

/** Sólo para tests: limpia la caché entre escenarios. */
export function __resetFacturapiClientCacheForTests(): void {
  clientCache.clear();
}

/**
 * FIX-04/32 (v13.303.12) — Timeout defensivo para llamadas al SDK FacturApi.
 *
 * El SDK `facturapi` no expone `AbortSignal` (verificado hasta v5.0.0); si la
 * red de FacturApi
 * cuelga, la promesa nunca resuelve y la Edge Function se queda ocupada hasta
 * que Deno la mata (~150 s). Cuando el call es el timbrado, el claim
 * `PENDING:<uuid>` queda tomado y la factura no se puede re-timbrar hasta que
 * `facturapi-recuperar-claim` la libere manualmente.
 *
 * Envuelve TODA llamada al SDK con `withFacturapiTimeout("op", sdkPromise)`.
 * Si el timeout dispara antes que el SDK responda, se rechaza con
 * `FacturapiTimeoutError` (HTTP 504 al cliente); el caller sigue siendo
 * responsable de liberar cualquier claim.
 */
export const FACTURAPI_SDK_TIMEOUT_MS = 30_000;

/**
 * v13.821.6 — Timeout SÓLO para `invoices.cancel`: al vencer, la edge todavía
 * tiene que persistir `cancellation_status='verifying'`, escribir bitácora y
 * responder 202 antes del límite de ejecución. Con 30 s no quedaba margen y el
 * usuario veía un error rojo aunque la solicitud sí llegó al SAT.
 */
export const FACTURAPI_CANCEL_TIMEOUT_MS = 22_000;


export class FacturapiTimeoutError extends Error {
  readonly status = 504;
  readonly op: string;
  readonly timeoutMs: number;
  constructor(op: string, timeoutMs: number) {
    super(`FacturApi no respondió en ${timeoutMs} ms (op=${op})`);
    this.name = "FacturapiTimeoutError";
    this.op = op;
    this.timeoutMs = timeoutMs;
  }
}

export function withFacturapiTimeout<T>(
  op: string,
  promise: Promise<T>,
  timeoutMs: number = FACTURAPI_SDK_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new FacturapiTimeoutError(op, timeoutMs)), timeoutMs);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
