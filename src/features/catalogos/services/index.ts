/**
 * Servicio de catálogos compartidos: navieras, puertos, tipos de contenedor
 * y tipo de cambio. Encapsula CRUD y RPC contra Supabase para que los hooks
 * solo manejen estado de React Query.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrapOr, run } from "@/lib/supabase/response";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { registrarActividad } from "@/services/bitacora/registrar";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Naviera {
  id: string;
  code: string;
  name: string;
  activo: boolean;
  created_at: string;
  tracking_url_template: string | null;
}

export interface Puerto {
  id: string;
  code: string;
  name: string;
  country: string;
  activo: boolean;
  created_at: string;
}

export interface TipoContenedor {
  id: string;
  code: string;
  name: string;
  activo: boolean;
  created_at: string;
}

export interface ExchangeRates {
  usdMxn: number;
  eurMxn: number;
  /** Fecha (ISO YYYY-MM-DD) del FIX efectivamente aplicado por Banxico. Sólo
   *  la edge la devuelve; puede quedar undefined si viene del fallback. */
  fechaAplicada?: string;
  /** FIX-10: `true` si los valores vienen del fallback (Banxico caído, sin token,
   *  error de red). Los flujos fiscales DEBEN rechazar rates con este flag. */
  esFallback?: boolean;
}

// ─── Navieras ────────────────────────────────────────────────────────────────

export async function fetchNavieras(includeInactive = false): Promise<Naviera[]> {
  // 12.34.0: .limit(500) defensivo (evita el cap silencioso de 1000 de PostgREST).
  let query = supabase.from("navieras").select("*").order("name").limit(500);
  if (!includeInactive) query = query.eq("activo", true);
  return fromDb<Naviera[]>(await unwrapOr(query, []));
}

export async function insertNaviera(input: { code: string; name: string }): Promise<void> {
  await run(supabase.from("navieras").insert(input));
}

export async function setNavieraActivo(id: string, activo: boolean): Promise<void> {
  await run(supabase.from("navieras").update({ activo }).eq("id", id));
}

export async function deleteNaviera(id: string): Promise<void> {
  await run(supabase.from("navieras").delete().eq("id", id));
}

// ─── Puertos ─────────────────────────────────────────────────────────────────

export async function fetchPuertos(includeInactive = false): Promise<Puerto[]> {
  let query = supabase.from("puertos").select("*").order("country").order("name").limit(500);
  if (!includeInactive) query = query.eq("activo", true);
  return fromDb<Puerto[]>(await unwrapOr(query, []));
}

export async function insertPuerto(input: { code: string; name: string; country: string }): Promise<void> {
  await run(supabase.from("puertos").insert(input));
}

export async function setPuertoActivo(id: string, activo: boolean): Promise<void> {
  // `.select("id")` permite detectar el caso "0 filas afectadas" (RLS sin permiso),
  // que Postgres NO reporta como error y antes fallaba en silencio.
  const filas = await unwrapOr(
    supabase.from("puertos").update({ activo }).eq("id", id).select("id"),
    [] as { id: string }[],
  );
  if (filas.length === 0) {
    throw new Error("No tienes permisos para activar o desactivar puertos.");
  }
}

export async function deletePuerto(id: string): Promise<void> {
  const filas = await unwrapOr(
    supabase.from("puertos").delete().eq("id", id).select("id"),
    [] as { id: string }[],
  );
  if (filas.length === 0) {
    throw new Error("No tienes permisos para eliminar puertos.");
  }
}


// ─── Tipos de contenedor ─────────────────────────────────────────────────────

export async function fetchTiposContenedor(includeInactive = false): Promise<TipoContenedor[]> {
  let query = supabase.from("tipos_contenedor").select("*").order("name").limit(500);
  if (!includeInactive) query = query.eq("activo", true);
  return fromDb<TipoContenedor[]>(await unwrapOr(query, []));
}

export async function insertTipoContenedor(input: { code: string; name: string }): Promise<void> {
  await run(supabase.from("tipos_contenedor").insert(input));
}

export async function setTipoContenedorActivo(id: string, activo: boolean): Promise<void> {
  await run(supabase.from("tipos_contenedor").update({ activo }).eq("id", id));
}

export async function deleteTipoContenedor(id: string): Promise<void> {
  await run(supabase.from("tipos_contenedor").delete().eq("id", id));
}

// ─── Tipo de cambio (edge function) ──────────────────────────────────────────

/**
 * Fallback operativo (NO fiscal) cuando la edge `exchange-rates` no responde.
 * Fuente única: cualquier consumidor debe importar esta constante en vez de
 * volver a codificar 17.25/18.5 (Ola 5 · A21).
 */
export const EXCHANGE_RATES_FALLBACK: ExchangeRates = { usdMxn: 17.25, eurMxn: 18.5, esFallback: true };

/**
 * @param fecha ISO `YYYY-MM-DD` opcional. Si se provee y es anterior a hoy,
 *   la edge devuelve la Publicación DOF vigente **ese** día (útil para
 *   valuar facturas de proveedor emitidas en el pasado). Sin fecha, o con
 *   fecha ≥ hoy, se comporta como antes (DOF de hoy).
 */
export async function fetchExchangeRates(fecha?: string): Promise<ExchangeRates> {
  const body = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? { fecha } : undefined;
  const { data, error } = await supabase.functions.invoke("exchange-rates", body ? { body } : {});
  if (error) {
    // `FunctionsFetchError` = el navegador no logró siquiera contactar la edge
    // (cold start, micro-corte de red, AdBlock). Es transitorio y la app tiene
    // fallback. Sólo dejamos breadcrumb, NO reportamos, y devolvemos los rates
    // fallback para evitar reintentos inútiles de React Query.
    const isFetchError =
      (error as { name?: string })?.name === "FunctionsFetchError";
    if (isFetchError) {
      void import("@sentry/react").then((Sentry) => {
        Sentry.addBreadcrumb({
          category: "exchange_rates",
          level: "warning",
          message: "exchange_rates.fetch_error.fallback",
          data: { name: (error as { name?: string })?.name },
        });
      }).catch(() => undefined);
      return EXCHANGE_RATES_FALLBACK;
    }
    // Errores no transitorios (5xx, JSON inválido) sí van a Sentry vía
    // `reportCaughtError` (13.320.22 · Tanda 1 · S1: reemplaza captura directa
    // para heredar tags de tenant/route/version).
    reportCaughtError(error, { feature: "exchange_rates", op: "edge_invoke" });
    throw error;
  }
  return {
    usdMxn: data?.usdMxn ?? EXCHANGE_RATES_FALLBACK.usdMxn,
    eurMxn: data?.eurMxn ?? EXCHANGE_RATES_FALLBACK.eurMxn,
    fechaAplicada: data?.fechaAplicada,
    // FIX-10: la edge usa snake_case (`es_fallback`), el cliente camelCase.
    esFallback: data?.es_fallback === true,
  };
}



/**
 * Q-13: edición de código/nombre de una naviera desde el catálogo admin.
 * NOTA: alta/activación/baja de navieras, puertos y tipos de contenedor ya
 * se registran en bitácora desde `createCatalogHooks` (hook compartido); no
 * se duplica aquí. `updateNaviera` no pasa por ese hook, así que se registra.
 */
export async function updateNaviera(id: string, input: { code: string; name: string }): Promise<void> {
  await run(supabase.from("navieras").update(input).eq("id", id));
  await registrarActividad({
    modulo: "catalogos",
    accion: "editar_navieras",
    entidadId: id,
    entidadNombre: input.name,
    detalles: { code: input.code },
  });
}
