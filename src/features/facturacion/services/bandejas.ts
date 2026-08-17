/**
 * Servicio de "bandejas de trabajo" del cockpit de Facturación (Fase 2).
 *
 * Cada bandeja expone un fetch específico y liviano. El conteo se saca
 * con `count: 'exact', head: true` para no traer payload.
 *
 * Todas las queries respetan el aislamiento multi-tenant filtrando por
 * `organization_id` explícito (además de las RLS que ya validan tenancy).
 */
import { supabase } from "@/integrations/supabase/client";
import { FECHA_INICIO_TIMBRADO_SISTEMA } from "@/features/facturacion/domain/facturaFlags";
import { todayLocalISO } from "@/lib/date/today";
import { warnIfTruncated } from "@/lib/supabase/assertNotTruncated";

const LIMITE_POR_TIMBRAR = 500;
const LIMITE_TIMBRADAS = 1000;
const ENVIOS_PAGE = 1000;

/**
 * EC-03: IDs de facturas con al menos un envío exitoso, paginando con
 * `.range()` porque PostgREST corta a `max-rows` SIN error y un Set
 * incompleto hacía reaparecer facturas ya enviadas en la bandeja.
 * Devuelve un Set de DISTINCT factura_id (sirve también al conteo EC-04).
 */
async function fetchIdsConEnvioExitoso(orgId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += ENVIOS_PAGE) {
    const { data, error } = await supabase
      .from("factura_envios")
      .select("factura_id")
      .eq("organization_id", orgId)
      .eq("estado", "enviado")
      .range(from, from + ENVIOS_PAGE - 1);
    if (error) throw error;
    for (const e of data ?? []) ids.add(e.factura_id);
    if (!data || data.length < ENVIOS_PAGE) break;
  }
  return ids;
}

export interface FilaPorTimbrar {
  id: string;
  numero: string;
  cliente_nombre: string;
  total: number;
  moneda: string;
  fecha_emision: string;
}

export interface FilaPorEnviar {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nombre: string;
  total: number;
  moneda: string;
  fecha_emision: string;
  uuid_fiscal: string;
}


export interface FilaRepPendiente {
  id: string;
  factura_id: string;
  factura_numero: string;
  cliente_nombre: string;
  fecha_pago: string;
  monto: number;
  moneda: string;
  estado_rep: string;
}

export async function fetchFacturasPorTimbrar(orgId: string): Promise<FilaPorTimbrar[]> {
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, cliente_nombre, total, moneda, fecha_emision")
    .eq("organization_id", orgId)
    .eq("estado", "Borrador")
    .is("facturapi_id", null)
    .is("deleted_at", null)
    .gte("fecha_emision", FECHA_INICIO_TIMBRADO_SISTEMA.slice(0, 10))
    .order("fecha_emision", { ascending: false })
    .limit(LIMITE_POR_TIMBRAR);
  if (error) throw error;
  warnIfTruncated(data, LIMITE_POR_TIMBRAR, "facturacion.fetchFacturasPorTimbrar");
  return (data ?? []) as FilaPorTimbrar[];
}

/**
 * Facturas timbradas (con UUID) que NO tienen un envío exitoso registrado.
 * Se hace en 2 pasos (facturas timbradas + IDs con envío exitoso) y se
 * filtra en memoria: es más simple que un left-join anti-pattern y el N
 * esperado es bajo.
 */
export async function fetchFacturasPorEnviar(orgId: string): Promise<FilaPorEnviar[]> {
  const [timbradasRes, enviadas] = await Promise.all([
    supabase
      .from("facturas")
      .select("id, numero, cliente_id, cliente_nombre, total, moneda, fecha_emision, uuid_fiscal")
      .eq("organization_id", orgId)
      .not("uuid_fiscal", "is", null)
      .in("estado", ["Emitida", "Parcialmente pagada", "Pagada"])
      .is("deleted_at", null)
      .order("fecha_emision", { ascending: false })
      .limit(LIMITE_TIMBRADAS),
    fetchIdsConEnvioExitoso(orgId),
  ]);
  if (timbradasRes.error) throw timbradasRes.error;
  warnIfTruncated(timbradasRes.data, LIMITE_TIMBRADAS, "facturacion.fetchFacturasPorEnviar");
  return ((timbradasRes.data ?? []) as FilaPorEnviar[]).filter((f) => !enviadas.has(f.id));
}

export async function fetchPagosRepPendientes(orgId: string): Promise<FilaRepPendiente[]> {
  const { data, error } = await supabase
    .from("pagos_factura")
    .select(
      "id, factura_id, fecha_pago, monto, moneda, estado_rep, facturas!inner(numero, cliente_nombre)",
    )
    .eq("organization_id", orgId)
    .in("estado_rep", ["Pendiente", "Error"])
    // A6: los pagos eliminados no deben aparecer en la bandeja de REP.
    .is("deleted_at", null)
    .order("fecha_pago", { ascending: false })
    .limit(500);
  if (error) throw error;
  type Row = {
    id: string; factura_id: string; fecha_pago: string;
    monto: number; moneda: string; estado_rep: string;
    facturas: { numero: string; cliente_nombre: string } | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    factura_id: r.factura_id,
    factura_numero: r.facturas?.numero ?? "—",
    cliente_nombre: r.facturas?.cliente_nombre ?? "—",
    fecha_pago: r.fecha_pago,
    monto: r.monto,
    moneda: r.moneda,
    estado_rep: r.estado_rep,
  }));
}

export interface BandejaConteos {
  porTimbrar: number;
  porEnviar: number;
  porCobrar: number;
  vencidas: number;
  repPendientes: number;
}

/**
 * Conteos livianos con `head: true` (no trae filas, sólo el `count`).
 * "Por facturar" (hueco) no se cuenta aquí: se lee del hook
 * `useHuecoFacturacion` que ya calcula su total.
 */
export async function fetchBandejaConteos(orgId: string): Promise<BandejaConteos> {
  const hoy = todayLocalISO();
  const [porTimbrar, timbradas, enviadasIds, porCobrar, vencidas, reps] = await Promise.all([
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("estado", "Borrador")
      .is("facturapi_id", null)
      .is("deleted_at", null)
      .gte("fecha_emision", FECHA_INICIO_TIMBRADO_SISTEMA.slice(0, 10)),
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("uuid_fiscal", "is", null)
      .in("estado", ["Emitida", "Parcialmente pagada", "Pagada"])
      .is("deleted_at", null),
    fetchIdsConEnvioExitoso(orgId),
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("estado", ["Emitida", "Parcialmente pagada"])
      .is("deleted_at", null)
      // EC-19: facturas sin fecha de vencimiento (import/migración o captura
      // incompleta) no entraban a ninguna cubeta; se cuentan como "por cobrar".
      .or(`fecha_vencimiento.is.null,fecha_vencimiento.gte.${hoy}`),
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("estado", ["Emitida", "Parcialmente pagada"])
      .is("deleted_at", null)
      .lt("fecha_vencimiento", hoy),
    supabase
      .from("pagos_factura")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("estado_rep", ["Pendiente", "Error"])
      .is("deleted_at", null),
  ]);
  // EC-04: "Por enviar" = timbradas − DISTINCT factura_id con envío exitoso.
  // Contar envíos crudos divergía de la lista cuando una factura se reenvía
  // (existe historial en factura_envios): badge y bandeja se contradecían.
  const porEnviar = Math.max(0, (timbradas.count ?? 0) - enviadasIds.size);
  return {
    porTimbrar: porTimbrar.count ?? 0,
    porEnviar,
    porCobrar: porCobrar.count ?? 0,
    vencidas: vencidas.count ?? 0,
    repPendientes: reps.count ?? 0,
  };
}
