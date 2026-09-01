/**
 * Loaders (I/O) del Dashboard Dirección. Sin lógica de cómputo.
 */
import { supabase } from "@/integrations/supabase/client";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";

// FIX C3 (S6-06): caps explícitos verificados por assertNotTruncated.
const LIMITE_EMBARQUES = 3000;
const LIMITE_FACTURAS = 10000;
const LIMITE_PAGOS = 20000;

/** Totales por moneda del dashboard de Dirección (jsonb de `direccion_totales`, C3c). */
export interface DireccionTotales {
  embarques: number;
  ventas: Record<string, number>;
  costos: Record<string, number>;
  facturado: Record<string, number>;
  cobrado: Record<string, number>;
}

/**
 * FIX C3c (S6-04): totales de Dirección agregados en SQL por moneda, sin
 * mezclar divisas — la conversión a MXN equivalente la hace el cliente con el
 * canon (FIX C6). Los loaders de detalle siguen para los widgets que listan.
 */
export async function fetchDireccionTotales(desdeIso: string): Promise<DireccionTotales> {
  const { data, error } = await supabase.rpc("direccion_totales", { p_desde: desdeIso });
  if (error) throw error;
  // SAFE-CAST: jsonb con el shape de la migración C3c.
  return data as unknown as DireccionTotales;
}

export type EmbarqueRow = {
  id: string; modo: string | null; estado: string | null; eta: string | null;
  cerrado_at: string | null; cliente_id: string | null; cliente_nombre: string | null;
  tipo_cambio_usd: number | null; tipo_cambio_eur: number | null;
};
export type ConceptoVentaRow = { embarque_id: string; total: number | null; moneda: string | null };
export type ConceptoCostoRow = { embarque_id: string; monto: number | null; moneda: string | null };
export type FacturaRow = {
  id: string; total: number | null; moneda: string; tipo_cambio: number | null;
  fecha_emision: string; fecha_vencimiento: string | null; estado: string;
  cliente_id: string | null; timbrado_en: string | null; uuid_fiscal: string | null;
  acuse_cancelacion_status: string | null;
};
export type PagoRow = {
  factura_id: string; monto_aplicado_factura: number | null; moneda: string;
  tipo_cambio: number | null; fecha_pago: string;
};
export type EmbarqueEstadoRow = { estado: string | null; eta: string | null };

export async function loadEmbarques(orgId: string | null, desdeIso: string): Promise<{
  embarques: EmbarqueRow[]; ventas: ConceptoVentaRow[]; costos: ConceptoCostoRow[];
}> {
  let q = supabase.from("embarques")
    .select("id, modo, estado, eta, cerrado_at, cliente_id, cliente_nombre, tipo_cambio_usd, tipo_cambio_eur")
    .is("deleted_at", null)
    // Ola 4 · N23: el EERR excluye Cancelado; los KPIs de Dirección deben usar
    // el mismo universo o venta/costo no cuadran entre pantallas.
    .neq("estado", "Cancelado")
    .or(`cerrado_at.gte.${desdeIso},eta.gte.${desdeIso}`)
    .limit(LIMITE_EMBARQUES);
  if (orgId) q = q.eq("organization_id", orgId);
  const { data: embarques, error } = await q;
  if (error) throw error;
  assertNotTruncated(embarques, LIMITE_EMBARQUES, "direccion.loadEmbarques");
  const ids = (embarques ?? []).map((e) => e.id);
  if (ids.length === 0) return { embarques: [], ventas: [], costos: [] };
  const [ventasRes, costosRes] = await Promise.all([
    supabase.from("conceptos_venta").select("embarque_id, total, moneda").in("embarque_id", ids).is("deleted_at", null),
    supabase.from("conceptos_costo").select("embarque_id, monto, moneda").in("embarque_id", ids).is("deleted_at", null),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  if (costosRes.error) throw costosRes.error;
  return {
    embarques: (embarques ?? []) as EmbarqueRow[],
    ventas: (ventasRes.data ?? []) as ConceptoVentaRow[],
    costos: (costosRes.data ?? []) as ConceptoCostoRow[],
  };
}

export async function loadFacturas(orgId: string | null, desdeIso: string) {
  let qF = supabase.from("facturas")
    .select("id, total, moneda, tipo_cambio, fecha_emision, fecha_vencimiento, estado, cliente_id, timbrado_en, uuid_fiscal, acuse_cancelacion_status")
    .gte("fecha_emision", desdeIso).is("deleted_at", null).limit(LIMITE_FACTURAS);
  if (orgId) qF = qF.eq("organization_id", orgId);
  const { data: facturas, error } = await qF;
  if (error) throw error;
  assertNotTruncated(facturas, LIMITE_FACTURAS, "direccion.loadFacturas");
  const ids = (facturas ?? []).map((f) => f.id);
  if (ids.length === 0) return { facturas: [] as FacturaRow[], pagos: [] as PagoRow[] };
  const { data: pagos, error: e2 } = await supabase.from("pagos_factura")
    .select("factura_id, monto_aplicado_factura, moneda, tipo_cambio, fecha_pago")
    .in("factura_id", ids).is("deleted_at", null).limit(LIMITE_PAGOS);
  if (e2) throw e2;
  assertNotTruncated(pagos, LIMITE_PAGOS, "direccion.loadPagos");
  return { facturas: (facturas ?? []) as FacturaRow[], pagos: (pagos ?? []) as PagoRow[] };
}

/**
 * P1-6: la cartera abierta (aging/vencido) debe incluir TODA factura viva con
 * saldo potencial > 0, sin importar cuándo se emitió — el loader de tendencia
 * (`loadFacturas`, ventana de 6 meses) borraba facturas abiertas más viejas.
 * Estados abiertos alineados con `cartera_pendiente()` (canon SQL).
 */
const ESTADOS_CARTERA_ABIERTA = ["Emitida", "Vencida", "Parcialmente pagada"] as const;

export async function loadCarteraAbierta(orgId: string | null): Promise<{
  facturas: FacturaRow[]; pagos: PagoRow[];
}> {
  let qF = supabase.from("facturas")
    .select("id, total, moneda, tipo_cambio, fecha_emision, fecha_vencimiento, estado, cliente_id, timbrado_en, uuid_fiscal, acuse_cancelacion_status")
    .in("estado", ESTADOS_CARTERA_ABIERTA).is("deleted_at", null).limit(LIMITE_FACTURAS);
  if (orgId) qF = qF.eq("organization_id", orgId);
  const { data: facturas, error } = await qF;
  if (error) throw error;
  assertNotTruncated(facturas, LIMITE_FACTURAS, "direccion.loadCarteraAbierta");
  const ids = (facturas ?? []).map((f) => f.id);
  if (ids.length === 0) return { facturas: [] as FacturaRow[], pagos: [] as PagoRow[] };
  const { data: pagos, error: e2 } = await supabase.from("pagos_factura")
    .select("factura_id, monto_aplicado_factura, moneda, tipo_cambio, fecha_pago")
    .in("factura_id", ids).is("deleted_at", null).limit(LIMITE_PAGOS);
  if (e2) throw e2;
  assertNotTruncated(pagos, LIMITE_PAGOS, "direccion.loadCarteraAbiertaPagos");
  return { facturas: (facturas ?? []) as FacturaRow[], pagos: (pagos ?? []) as PagoRow[] };
}

export async function loadEmbarquesActivos(orgId: string | null): Promise<EmbarqueEstadoRow[]> {
  let q = supabase.from("embarques")
    .select("estado, eta")
    .is("deleted_at", null)
    // Ola 4 · N21: "activos" son embarques en operación. Borrador/Cotización aún
    // no operan y Por liquidar/Cerrado/EIR ya cerraron: incluirlos inflaba el KPI.
    .not("estado", "in", '("Cotización","Borrador","Por liquidar","Cerrado","EIR","Entregado","Cancelado")')
    .limit(LIMITE_EMBARQUES);
  if (orgId) q = q.eq("organization_id", orgId);
  const { data, error } = await q;
  if (error) throw error;
  assertNotTruncated(data, LIMITE_EMBARQUES, "direccion.loadEmbarquesActivos");
  return (data ?? []) as EmbarqueEstadoRow[];
}
