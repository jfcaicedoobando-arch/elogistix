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
// deno-lint-ignore-file no-explicit-any
import { resolveFacturapiKey, type FacturapiResolveResult } from "./facturapiAuth.ts";

export type FacturapiClient = any;

const clientCache = new Map<string, FacturapiClient>();
let FacturapiCtor: any | null = null;

async function loadFacturapiCtor(): Promise<any> {
  if (FacturapiCtor) return FacturapiCtor;
  // Indirección por variable para que el typecheck de Deno no intente
  // resolver `npm:facturapi@5` en tiempo de compilación (sólo se carga en
  // tiempo de ejecución dentro de la edge function).
  const sdkSpec = "npm:facturapi@5";
  const mod = await import(sdkSpec);
  FacturapiCtor = (mod as any).default?.default ?? (mod as any).default ?? mod;
  return FacturapiCtor;
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
  supabase: any,
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

/**
 * Normaliza un error lanzado por el SDK de FacturApi a `{ status, detail }`
 * para responder al cliente con un shape consistente.
 */
export function describeFacturapiError(err: unknown): { status: number; detail: unknown } {
  const anyErr = err as any;
  // El SDK adjunta `response.data` y `response.status` para errores HTTP.
  const status: number = anyErr?.response?.status ?? anyErr?.status ?? 502;
  const detail: unknown = anyErr?.response?.data ?? anyErr?.data ?? {
    message: anyErr?.message ?? String(err),
  };
  return { status, detail };
}

/** Sólo para tests: limpia la caché entre escenarios. */
export function __resetFacturapiClientCacheForTests(): void {
  clientCache.clear();
  FacturapiCtor = null;
}
