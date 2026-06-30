/**
 * facturapiClient — Devuelve una instancia del SDK oficial `facturapi-node`
 * (v5+) ya configurada para la organización dada.
 *
 * Carga el SDK vía `npm:facturapi@5` (Deno) y cachea el cliente por API key
 * para evitar reinstanciar en invocaciones encadenadas dentro de la misma
 * instancia del runtime.
 *
 * El ambiente (sandbox/live) se decide implícitamente por la API key que
 * `resolveFacturapiKey` entrega (cada secret apunta a su ambiente).
 *
 * Sólo este módulo puede importar `npm:facturapi`. Las edge functions deben
 * usar `getFacturapiClient(supabase, organizationId)`.
 */
import { resolveFacturapiKey, type FacturapiResolveResult, type SupabaseLike } from "./facturapiAuth.ts";

// El SDK `facturapi-node` no exporta tipos accesibles desde el typecheck de
// Deno (lo cargamos dinámicamente). Lo modelamos como un objeto opaco.
export type FacturapiClient = object;
type FacturapiCtorType = new (apiKey: string) => FacturapiClient;

const clientCache = new Map<string, FacturapiClient>();

// Carga eager del SDK a nivel de módulo: la descarga/parseo del paquete
// `facturapi` ocurre durante el `boot` del worker de Deno (antes de que la
// función empiece a aceptar requests), NO en el hot path del primer request.
//
// IMPORTANTE: pineado a `^4.18.0` porque la última versión publicada del
// paquete `facturapi` en npm es 4.x. Antes apuntábamos a `npm:facturapi@5`
// (no existe) y Deno crasheaba el event loop del worker en boot con
// `Could not find constraint 'facturapi@5' in the list of packages.`, lo que
// hacía que TODO request a la función fallara con "Failed to send a request
// to the Edge Function" (Sentry JAVASCRIPT-REACT-1S).
//
// Además: capturamos la rejection del import top-level para que un fallo de
// carga no tire el worker entero. El error se rethrowea cuando
// `loadFacturapiCtor()` se invoca, así otras edge functions que importen
// este shared module no se rompen en boot.
const sdkSpec = "npm:facturapi@^4.18.0";
const sdkModulePromise: Promise<{
  default?: FacturapiCtorType | { default?: FacturapiCtorType };
}> = (import(sdkSpec) as Promise<{
  default?: FacturapiCtorType | { default?: FacturapiCtorType };
}>).catch((err) => {
  console.error("[facturapiClient] SDK import failed", err);
  throw err;
});

async function loadFacturapiCtor(): Promise<FacturapiCtorType> {
  const mod = await sdkModulePromise;
  const def = mod.default;
  const ctor = (def && typeof def === "object" && "default" in def
    ? def.default
    : def) as FacturapiCtorType | undefined;
  return ctor ?? (mod as unknown as FacturapiCtorType);
}

export interface FacturapiClientResolved {
  client: FacturapiClient;
  apiKey: string;
  ambiente: "sandbox" | "live";
  facturapiOrgId: string | null;
  legacy: boolean;
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

  const { apiKey, ambiente, facturapiOrgId, legacy } = resolved.data;

  let client = clientCache.get(apiKey);
  if (!client) {
    const Ctor = await loadFacturapiCtor();
    client = new Ctor(apiKey);
    clientCache.set(apiKey, client);
  }

  return {
    ok: true,
    data: { client, apiKey, ambiente, facturapiOrgId, legacy },
  };
}

interface FacturapiErrorShape {
  response?: { status?: number; data?: unknown };
  status?: number;
  data?: unknown;
  message?: string;
}

/**
 * Normaliza un error lanzado por el SDK de FacturApi a `{ status, detail }`
 * para responder al cliente con un shape consistente.
 */
export function describeFacturapiError(err: unknown): { status: number; detail: unknown } {
  const e = (err ?? {}) as FacturapiErrorShape;
  const status: number = e.response?.status ?? e.status ?? 502;
  const detail: unknown = e.response?.data ?? e.data ?? {
    message: e.message ?? String(err),
  };
  return { status, detail };
}

/** Sólo para tests: limpia la caché entre escenarios. */
export function __resetFacturapiClientCacheForTests(): void {
  clientCache.clear();
}
