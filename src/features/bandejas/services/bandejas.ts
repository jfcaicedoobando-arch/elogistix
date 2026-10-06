import { supabase } from "@/integrations/supabase/client";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import { fetchInChunks } from "@/lib/supabase/chunkedIn";

import type { CxpPorCapturarRow, CxpPorPagarRow, CarteraPendienteRow } from "../types/bandejas";
export type { CxpPorCapturarRow, CxpPorPagarRow, CarteraPendienteRow } from "../types/bandejas";

export async function fetchCxpPorCapturar(): Promise<CxpPorCapturarRow[]> {
  const { data, error } = await supabase.rpc("cxp_por_capturar");
  if (error) throw error;
  // Ola 4 · N43: la RPC lleva LIMIT 500; sin esto los KPIs mentían en silencio.
  assertNotTruncated(data, 500, "bandejas.cxpPorCapturar");
  const rows = (data ?? []) as CxpPorCapturarRow[];
  const referencias = await fetchInChunks(rows.map((r) => r.embarque_id), async (ids) => {
    const resultado = await supabase.from("embarques")
      .select("id, expediente, estado, cotizacion:cotizaciones!embarques_cotizacion_id_fkey(folio, deleted_at)")
      .in("id", ids).is("deleted_at", null);
    if (resultado.error) throw resultado.error;
    return resultado.data ?? [];
  });
  const porId = new Map(referencias.map((r) => [r.id, r]));
  return rows.map((row) => {
    const ref = porId.get(row.embarque_id);
    return { ...row, expediente: ref?.expediente ?? row.expediente,
      estado_embarque: ref?.estado ?? null,
      cotizacion_folio: ref?.cotizacion?.deleted_at == null ? ref?.cotizacion?.folio ?? null : null };
  });
}

export async function fetchCxpPorPagar(): Promise<CxpPorPagarRow[]> {
  const { data, error } = await supabase.rpc("cxp_por_pagar");
  if (error) throw error;
  // Ola 4 · N43: la RPC lleva LIMIT 500; sin esto los KPIs mentían en silencio.
  assertNotTruncated(data, 500, "bandejas.cxpPorPagar");
  return (data ?? []) as CxpPorPagarRow[];
}



/** Tope de filas que devuelve la RPC `cartera_pendiente` (LIMIT 500). */
export const CARTERA_PENDIENTE_LIMITE = 500;

export interface CarteraPendienteResultado {
  rows: CarteraPendienteRow[];
  /** Facturas con saldo > 0 que existen en la base (sin tope). */
  total: number;
  /** `true` cuando la base tiene más facturas de las que devolvió la RPC. */
  truncado: boolean;
}

/**
 * N10 (v13.823.390): la RPC lleva LIMIT 500 y antes se lanzaba
 * `assertNotTruncated`, con lo que la pantalla completa quedaba en error y sin
 * datos. Ahora se acompaña del conteo real (`cartera_pendiente_total`) para
 * mostrar el listado y AVISAR de forma explícita que está incompleto: nunca se
 * presenta el subconjunto como si fuera el total.
 */
export async function fetchCarteraPendiente(): Promise<CarteraPendienteResultado> {
  const [lista, conteo] = await Promise.all([
    supabase.rpc("cartera_pendiente"),
    supabase.rpc("cartera_pendiente_total"),
  ]);
  if (lista.error) throw lista.error;
  if (conteo.error) throw conteo.error;
  const rows = (lista.data ?? []) as CarteraPendienteRow[];
  const fiscales = await fetchInChunks(rows.map((r) => r.factura_id), async (ids) => {
    const result = await supabase.from("facturas").select("id, metodo_pago, uuid_fiscal")
      .in("id", ids).is("deleted_at", null);
    if (result.error) throw result.error;
    return result.data ?? [];
  });
  const porId = new Map(fiscales.map((f) => [f.id, f]));
  const completas = rows.map((r) => ({ ...r,
    metodo_pago: porId.get(r.factura_id)?.metodo_pago ?? null,
    uuid_fiscal: porId.get(r.factura_id)?.uuid_fiscal ?? null,
  }));
  const total = Number(conteo.data ?? rows.length);
  return { rows: completas, total, truncado: total > rows.length };
}
