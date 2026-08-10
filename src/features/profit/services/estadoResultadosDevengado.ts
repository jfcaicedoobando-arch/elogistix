/**
 * Fuente devengada del Estado de Resultados (post-Sprint 2):
 *   Ingresos = facturas con fecha_emision en el mes (no canceladas)
 *              menos notas de crédito aplicadas en el mes.
 *   Costos  = proveedor_facturas con fecha_emision en el mes (no canceladas)
 *              menos notas de crédito proveedor aplicadas.
 *
 * Pivot por modo del embarque vinculado (facturas.expediente → embarques /
 * proveedor_facturas.embarque_id → embarques). Filas sin embarque caen a
 * "Marítimo" como fallback (la mayoría del negocio); el conteo de Aéreo /
 * Terrestre depende del vínculo correcto al embarque.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr } from "@/lib/supabase/response";
import { tcFallbackDof } from "./estadoResultadosTc";
import {
  ingresosDeFacturas,
  ingresosDeNotas,
  costosDeProveedorFacturas,
} from "./estadoResultadosBuckets";
import { rangoMes } from "@/features/facturacion/domain/proyeccionFacturacion";
import { FACTURA_ESTADOS_VIVOS } from "@/lib/domain/estadosFactura";
import {
  buildEstadoResultados,
  type EstadoResultados,
  type EmbarqueER,
  type ConceptoVentaER,
  type ConceptoCostoER,
} from "@/features/profit/domain/estadoResultados";
import {
  mapFacturaRows,
  mapNotaCreditoRows,
  mapProveedorFacturaRows,
  mapEmbarqueERRows,
  mapEmbarqueERConExpediente,
  type FacturaRow,
  type NotaCreditoRow,
  type ProveedorFacturaRow,
} from "@/lib/mappers/estadoResultadosRows";

interface Params {
  organizationId: string | null;
  year: number;
  month: number;
}

async function loadEmbarquesPorIds(ids: string[]): Promise<EmbarqueER[]> {
  if (ids.length === 0) return [];
  const data = await unwrapOr(
    supabase
      .from("embarques")
      .select("id, modo, tipo_cambio_usd, tipo_cambio_eur")
      .in("id", ids),
    [],
  );
  return mapEmbarqueERRows(data);
}

async function loadEmbarquesPorExpedientes(exps: string[]): Promise<Map<string, EmbarqueER>> {
  if (exps.length === 0) return new Map();
  const data = await unwrapOr(
    supabase
      .from("embarques")
      .select("id, modo, tipo_cambio_usd, tipo_cambio_eur, expediente")
      .in("expediente", exps),
    [],
  );
  const map = new Map<string, EmbarqueER>();
  for (const e of mapEmbarqueERConExpediente(data)) {
    if (e.expediente) map.set(e.expediente, e);
  }
  return map;
}

async function fetchFacturasMes(orgId: string | null, desde: string, hasta: string): Promise<FacturaRow[]> {
  let q = supabase
    .from("facturas")
    .select("id, expediente, total, moneda, fecha_emision, tipo_cambio")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    // Excluye Cancelada y Sustituida: ambas dejan de ser CFDI vigentes y no
    // deben sumar en el EERR devengado. Ref: FACTURA_ESTADOS_VIVOS.
    .in("estado", [...FACTURA_ESTADOS_VIVOS]);
  if (orgId) q = q.eq("organization_id", orgId);
  return mapFacturaRows(await unwrapOr(q, []));
}

async function fetchNotasCreditoMes(orgId: string | null, desde: string, hasta: string): Promise<NotaCreditoRow[]> {
  let q = supabase
    .from("factura_notas_credito")
    .select("monto, moneda, factura_id, updated_at, tipo_cambio")
    .eq("estado", "Aplicada")
    .gte("updated_at", `${desde}T00:00:00`)
    .lte("updated_at", `${hasta}T23:59:59`)
    .is("deleted_at", null);
  if (orgId) q = q.eq("organization_id", orgId);
  return mapNotaCreditoRows(await unwrapOr(q, []));
}

async function fetchProveedorFacturasMes(orgId: string | null, desde: string, hasta: string): Promise<ProveedorFacturaRow[]> {
  let q = supabase
    .from("proveedor_facturas")
    .select("id, embarque_id, total, moneda, fecha_emision, tipo_cambio_usd")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    .neq("estado", "Cancelada")
    .is("deleted_at", null);
  if (orgId) q = q.eq("organization_id", orgId);
  return mapProveedorFacturaRows(await unwrapOr(q, []));
}

export async function fetchEstadoResultadosDevengado(p: Params): Promise<EstadoResultados> {
  const { desde, hasta } = rangoMes(p.year, p.month);

  const [facturas, ncs, pfacts, tc] = await Promise.all([
    fetchFacturasMes(p.organizationId, desde, hasta),
    fetchNotasCreditoMes(p.organizationId, desde, hasta),
    fetchProveedorFacturasMes(p.organizationId, desde, hasta),
    tcFallbackDof(),
  ]);

  const exps = Array.from(new Set(facturas.map((f) => f.expediente).filter(Boolean) as string[]));
  const embIds = Array.from(new Set(pfacts.map((f) => f.embarque_id).filter(Boolean) as string[]));
  const [embPorExp, embPorId] = await Promise.all([
    loadEmbarquesPorExpedientes(exps),
    loadEmbarquesPorIds(embIds),
  ]);

  const ventasBucket = { embarques: [] as EmbarqueER[], ventas: [] as ConceptoVentaER[] };
  ingresosDeFacturas(facturas, embPorExp, ventasBucket, tc);
  ingresosDeNotas(ncs, ventasBucket, tc);

  const costosBucket = { embarques: [] as EmbarqueER[], costos: [] as ConceptoCostoER[] };
  costosDeProveedorFacturas(pfacts, embPorId, costosBucket, tc);

  return buildEstadoResultados(
    [...ventasBucket.embarques, ...costosBucket.embarques],
    ventasBucket.ventas,
    costosBucket.costos,
  );
}
