import { supabase } from "@/integrations/supabase/client";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";

export interface CxpPorCapturarRow {
  embarque_id: string;
  expediente: string | null;
  cliente_nombre: string | null;
  presupuestado_mxn: number;
  presupuestado_usd: number;
  facturado_mxn: number;
  facturado_usd: number;
  facturas_capturadas: number;
  ultima_factura_fecha: string | null;
  dias_desde_ultima_factura: number | null;
}

export interface CxpPorPagarRow {
  factura_id: string;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  proveedor_origen: string | null;
  folio_proveedor: string | null;
  embarque_id: string | null;
  expediente: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  dias_para_vencer: number | null;
  moneda: string;
  total: number;
  pagado: number;
  saldo: number;
  estado_captura: string;
  tipo_cambio_usd: number | null;
  fecha_programada_pago: string | null;
}


export interface CarteraPendienteRow {
  factura_id: string;
  numero: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  embarque_id: string | null;
  expediente: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  dias_vencido: number;
  moneda: string;
  total: number;
  pagado: number;
  saldo: number;
  ultimo_contacto: string | null;
  estado: string;
  /** v13.592.0: trámite de cancelación ante el SAT (none|pending|verifying|…). */
  cancellation_status?: string | null;
}

export async function fetchCxpPorCapturar(): Promise<CxpPorCapturarRow[]> {
  const { data, error } = await supabase.rpc("cxp_por_capturar");
  if (error) throw error;
  // Ola 4 · N43: la RPC lleva LIMIT 500; sin esto los KPIs mentían en silencio.
  assertNotTruncated(data, 500, "bandejas.cxpPorCapturar");
  return (data ?? []) as CxpPorCapturarRow[];
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
  const total = Number(conteo.data ?? rows.length);
  return { rows, total, truncado: total > rows.length };
}
