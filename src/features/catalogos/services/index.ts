/**
 * Servicio de catálogos compartidos: navieras, puertos, tipos de contenedor
 * y tipo de cambio. Encapsula CRUD y RPC contra Supabase para que los hooks
 * solo manejen estado de React Query.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrapOr, run } from "@/lib/supabase/response";
import { warnIfTruncated } from "@/lib/supabase/assertNotTruncated";
import { registrarActividad } from "@/services/bitacora/registrar";

/** Límite defensivo de catálogos (PostgREST corta a max-rows sin avisar). */
const LIMITE_CATALOGOS = 500;

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
  /** EF-04: `true` si el EUR es estimado (18.5) aunque el USD sea real. Los
   *  flujos en moneda EUR DEBEN rechazar/marcar el TC cuando este flag está. */
  eurEsFallback?: boolean;
}

// ─── Navieras ────────────────────────────────────────────────────────────────

export async function fetchNavieras(includeInactive = false): Promise<Naviera[]> {
  // 12.34.0: .limit(500) defensivo (evita el cap silencioso de 1000 de PostgREST).
  let query = supabase.from("navieras").select("*").order("name").limit(LIMITE_CATALOGOS);
  if (!includeInactive) query = query.eq("activo", true);
  const rows = fromDb<Naviera[]>(await unwrapOr(query, []));
  warnIfTruncated(rows, LIMITE_CATALOGOS, "catalogos.fetchNavieras");
  return rows;
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
  let query = supabase.from("puertos").select("*").order("country").order("name").limit(LIMITE_CATALOGOS);
  if (!includeInactive) query = query.eq("activo", true);
  const rows = fromDb<Puerto[]>(await unwrapOr(query, []));
  warnIfTruncated(rows, LIMITE_CATALOGOS, "catalogos.fetchPuertos");
  return rows;
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
  let query = supabase.from("tipos_contenedor").select("*").order("name").limit(LIMITE_CATALOGOS);
  if (!includeInactive) query = query.eq("activo", true);
  const rows = fromDb<TipoContenedor[]>(await unwrapOr(query, []));
  warnIfTruncated(rows, LIMITE_CATALOGOS, "catalogos.fetchTiposContenedor");
  return rows;
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
// Movido a `./exchangeRates` (Power of 10: archivo ≤200 líneas). Se re-exporta
// para no romper los imports existentes.
export { EXCHANGE_RATES_FALLBACK, fetchExchangeRates } from "./exchangeRates";

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
