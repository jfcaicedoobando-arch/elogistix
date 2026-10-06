/**
 * Loaders (I/O) del Dashboard Dirección. Sin lógica de cómputo.
 */
import { supabase } from "@/integrations/supabase/client";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
import { fetchInChunks } from "@/lib/supabase/chunkedIn";
import { NC_CLIENTE_ESTADOS_VIGENTES } from "@/lib/domain/estadosFactura";
import { fetchVentaFacturadaEmbarques } from "@/features/facturacion";


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
  /** Ola v17: un pago con REP cancelado está ANULADO y no cuenta como cobrado. */
  estado_rep?: string | null;
};
/** NC de cliente APLICADAS (canon de Cobranza): restan del saldo de la factura. */
export type NotaCreditoRow = {
  factura_id: string; monto: number | null; moneda: string; tipo_cambio: number | null;
};

export type EmbarqueEstadoRow = { estado: string | null; eta: string | null };

export async function loadEmbarques(orgId: string | null, desdeIso: string): Promise<{
  embarques: EmbarqueRow[]; ventas: ConceptoVentaRow[]; costos: ConceptoCostoRow[];
}> {
  const embarques = await leerTodasLasPaginas<EmbarqueRow>("direccion.loadEmbarques", (desde, hasta) => {
    let q = supabase.from("embarques")
      .select("id, modo, estado, eta, cerrado_at, cliente_id, cliente_nombre, tipo_cambio_usd, tipo_cambio_eur")
      .is("deleted_at", null)
      .neq("estado", "Cancelado")
      .or(`cerrado_at.gte.${desdeIso},eta.gte.${desdeIso}`)
      .order("id", { ascending: true })
      .range(desde, hasta);
    if (orgId) q = q.eq("organization_id", orgId);
    return q;
  });
  const ids = embarques.map((e) => e.id);
  if (ids.length === 0) return { embarques: [], ventas: [], costos: [] };
  // Ronda YAGNI · defecto 1: antes ambas relaciones se pedían sin paginar, así
  // que PostgREST devolvía como máximo `max-rows` (1000) filas SIN error y
  // venta/costo/margen/top clientes se calculaban sobre un subconjunto mudo.
  // Ahora se leen COMPLETAS por lotes de IDs + páginas, y un exceso real falla
  // visible (ResultadoTruncadoError) en vez de mostrar un total equivocado.
  const [ventas, costos] = await Promise.all([
    loadConceptosVenta(ids),
    loadConceptosCosto(ids),
  ]);
  return { embarques, ventas, costos };
}

/** AUD-ANALISIS-8: venta = facturas timbradas vigentes − notas de crédito. */
async function loadConceptosVenta(ids: string[]): Promise<ConceptoVentaRow[]> {
  return fetchVentaFacturadaEmbarques(ids);
}

async function loadConceptosCosto(ids: string[]): Promise<ConceptoCostoRow[]> {
  return fetchInChunks(ids, (lote) =>
    leerTodasLasPaginas<ConceptoCostoRow>("direccion.conceptosCosto", (desde, hasta) =>
      supabase
        .from("conceptos_costo")
        .select("embarque_id, monto, moneda")
        .in("embarque_id", lote)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(desde, hasta),
    ),
  );
}

export async function loadFacturas(orgId: string | null, desdeIso: string) {
  const facturas = await leerTodasLasPaginas<FacturaRow>("direccion.loadFacturas", (desde, hasta) => {
    let q = supabase.from("facturas")
      .select("id, total, moneda, tipo_cambio, fecha_emision, fecha_vencimiento, estado, cliente_id, timbrado_en, uuid_fiscal, acuse_cancelacion_status")
      .gte("fecha_emision", desdeIso).is("deleted_at", null)
      .order("id", { ascending: true }).range(desde, hasta);
    if (orgId) q = q.eq("organization_id", orgId);
    return q;
  });
  const ids = facturas.map((f) => f.id);
  if (ids.length === 0) return { facturas: [] as FacturaRow[], pagos: [] as PagoRow[] };
  const pagos = await loadPagos(ids, "direccion.loadPagos");
  return { facturas, pagos };
}

function loadPagos(ids: string[], contexto: string): Promise<PagoRow[]> {
  return fetchInChunks(ids, (lote) =>
    leerTodasLasPaginas<PagoRow>(contexto, (desde, hasta) =>
      supabase.from("pagos_factura")
        .select("factura_id, monto_aplicado_factura, moneda, tipo_cambio, fecha_pago, estado_rep")
        .in("factura_id", lote).is("deleted_at", null)
        .order("id", { ascending: true }).range(desde, hasta),
    ),
  );
}

function loadNotasCredito(ids: string[]): Promise<NotaCreditoRow[]> {
  return fetchInChunks(ids, (lote) =>
    leerTodasLasPaginas<NotaCreditoRow>("direccion.loadCarteraAbiertaNotasCredito", (desde, hasta) =>
      supabase.from("factura_notas_credito")
        .select("factura_id, monto, moneda, tipo_cambio")
        .in("factura_id", lote).in("estado", [...NC_CLIENTE_ESTADOS_VIGENTES]).is("deleted_at", null)
        .order("id", { ascending: true }).range(desde, hasta),
    ),
  );
}

/**
 * P1-6: la cartera abierta (aging/vencido) debe incluir TODA factura viva con
 * saldo potencial > 0, sin importar cuándo se emitió — el loader de tendencia
 * (`loadFacturas`, ventana de 6 meses) borraba facturas abiertas más viejas.
 * Estados abiertos alineados con `cartera_pendiente()` (canon SQL).
 */
const ESTADOS_CARTERA_ABIERTA = ["Emitida", "Vencida", "Parcialmente pagada"] as const;

export async function loadCarteraAbierta(orgId: string | null): Promise<{
  facturas: FacturaRow[]; pagos: PagoRow[]; ncs: NotaCreditoRow[];
}> {
  const facturas = await leerTodasLasPaginas<FacturaRow>("direccion.loadCarteraAbierta", (desde, hasta) => {
    let q = supabase.from("facturas")
      .select("id, total, moneda, tipo_cambio, fecha_emision, fecha_vencimiento, estado, cliente_id, timbrado_en, uuid_fiscal, acuse_cancelacion_status")
      .in("estado", ESTADOS_CARTERA_ABIERTA).is("deleted_at", null)
      .order("id", { ascending: true }).range(desde, hasta);
    if (orgId) q = q.eq("organization_id", orgId);
    return q;
  });
  const ids = facturas.map((f) => f.id);
  if (ids.length === 0) {
    return { facturas: [] as FacturaRow[], pagos: [] as PagoRow[], ncs: [] as NotaCreditoRow[] };
  }
  // Canon de Cobranza: saldo = total − pagos − NC APLICADAS (vigentes).
  // Borrador/Aprobada/Timbrada/Cancelada y NC eliminadas no restan.
  const [pagos, ncs] = await Promise.all([
    loadPagos(ids, "direccion.loadCarteraAbiertaPagos"),
    loadNotasCredito(ids),
  ]);
  return { facturas, pagos, ncs };
}


export async function loadEmbarquesActivos(orgId: string | null): Promise<EmbarqueEstadoRow[]> {
  return leerTodasLasPaginas<EmbarqueEstadoRow>("direccion.loadEmbarquesActivos", (desde, hasta) => {
    let q = supabase.from("embarques")
      .select("estado, eta")
      .is("deleted_at", null)
      .not("estado", "in", '("Cotización","Borrador","Por liquidar","Cerrado","EIR","Entregado","Cancelado")')
      .order("id", { ascending: true }).range(desde, hasta);
    if (orgId) q = q.eq("organization_id", orgId);
    return q;
  });
}
