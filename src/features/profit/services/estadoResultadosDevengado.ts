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
      .in("id", ids)
      .is("deleted_at", null),
    [],
  );
  return mapEmbarqueERRows(data);
}

async function loadEmbarquesPorExpedientes(
  exps: string[],
  organizationId: string | null,
): Promise<Map<string, EmbarqueER>> {
  if (exps.length === 0) return new Map();
  let q = supabase
    .from("embarques")
    .select("id, modo, tipo_cambio_usd, tipo_cambio_eur, expediente")
    .in("expediente", exps)
    .is("deleted_at", null);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const data = await unwrapOr(q, []);
  const map = new Map<string, EmbarqueER>();
  for (const e of mapEmbarqueERConExpediente(data)) {
    if (e.expediente) map.set(e.expediente, e);
  }
  return map;
}

async function fetchFacturasMes(orgId: string | null, desde: string, hasta: string): Promise<FacturaRow[]> {
  let q = supabase
    .from("facturas")
    // BL-06: `subtotal` (sin IVA) en lugar de `total` (con IVA).
    .select("id, expediente, subtotal, moneda, fecha_emision, tipo_cambio")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    // Excluye Cancelada y Sustituida: ambas dejan de ser CFDI vigentes y no
    // deben sumar en el EERR devengado. Ref: FACTURA_ESTADOS_VIVOS.
    .in("estado", [...FACTURA_ESTADOS_VIVOS])
    .is("deleted_at", null);
  if (orgId) q = q.eq("organization_id", orgId);
  return mapFacturaRows(await unwrapOr(q, []));
}

async function fetchNotasCreditoMes(orgId: string | null, desde: string, hasta: string): Promise<NotaCreditoRow[]> {
  let q = supabase
    .from("factura_notas_credito")
    // BL-10: ubicar la NC por su `fecha_emision` (DATE de negocio, inmutable),
    // no por `updated_at`: cualquier UPDATE posterior movía el reconocimiento a
    // otro mes y las fronteras naive T00:00:00/T23:59:59 se interpretaban en
    // UTC, desplazando 6 h las NCs de fin de mes (TZ MX). El rango YYYY-MM-DD
    // viene de `rangoMes`, igual que facturas.
    .select("monto, moneda, factura_id, fecha_emision, tipo_cambio")
    .eq("estado", "Aplicada")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    .is("deleted_at", null);
  if (orgId) q = q.eq("organization_id", orgId);
  return mapNotaCreditoRows(await unwrapOr(q, []));
}

async function fetchProveedorFacturasMes(orgId: string | null, desde: string, hasta: string): Promise<ProveedorFacturaRow[]> {
  let q = supabase
    .from("proveedor_facturas")
    // BL-06: `subtotal` (sin IVA) en lugar de `total` (con IVA).
    .select("id, embarque_id, subtotal, moneda, fecha_emision, tipo_cambio_usd")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    .neq("estado", "Cancelada")
    .is("deleted_at", null);
  if (orgId) q = q.eq("organization_id", orgId);
  return mapProveedorFacturaRows(await unwrapOr(q, []));
}

/**
 * BL-8: resuelve el modo de transporte real de cada NC a través de su factura
 * padre (`factura_id` → `expediente` → embarque). Las facturas del mes ya están
 * cargadas; sólo se consultan los `factura_id` que faltan (NC de meses previos).
 */
async function modoPorFacturaDeNotas(
  ncs: NotaCreditoRow[],
  facturas: FacturaRow[],
  embPorExp: Map<string, EmbarqueER>,
  organizationId: string | null,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const idsNc = Array.from(new Set(ncs.map((n) => n.factura_id).filter(Boolean)));
  if (idsNc.length === 0) return out;

  const expPorFactura = new Map<string, string | null>();
  for (const f of facturas) {
    if (idsNc.includes(f.id)) expPorFactura.set(f.id, f.expediente ?? null);
  }

  const faltantes = idsNc.filter((id) => !expPorFactura.has(id));
  if (faltantes.length > 0) {
    const data = await unwrapOr(supabase.from("facturas")
      .select("id, expediente").in("id", faltantes).is("deleted_at", null), []);

    for (const row of data as { id: string; expediente: string | null }[]) {
      expPorFactura.set(row.id, row.expediente ?? null);
    }
  }

  const expsFaltantes = Array.from(
    new Set(
      Array.from(expPorFactura.values()).filter(
        (e): e is string => typeof e === "string" && e.length > 0 && !embPorExp.has(e),
      ),
    ),
  );
  const extra: Map<string, EmbarqueER> =
    expsFaltantes.length > 0
      ? await loadEmbarquesPorExpedientes(expsFaltantes, organizationId)
      : new Map();

  for (const [facturaId, exp] of expPorFactura) {
    if (!exp) continue;
    const emb = embPorExp.get(exp) ?? extra.get(exp);
    if (emb?.modo) out.set(facturaId, emb.modo);
  }
  return out;
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
    loadEmbarquesPorExpedientes(exps, p.organizationId),
    loadEmbarquesPorIds(embIds),
  ]);

  const modoNc = await modoPorFacturaDeNotas(ncs, facturas, embPorExp, p.organizationId);

  const ventasBucket = { embarques: [] as EmbarqueER[], ventas: [] as ConceptoVentaER[] };
  ingresosDeFacturas(facturas, embPorExp, ventasBucket, tc);
  ingresosDeNotas(ncs, ventasBucket, tc, modoNc);

  const costosBucket = { embarques: [] as EmbarqueER[], costos: [] as ConceptoCostoER[] };
  costosDeProveedorFacturas(pfacts, embPorId, costosBucket, tc);

  return buildEstadoResultados(
    [...ventasBucket.embarques, ...costosBucket.embarques],
    ventasBucket.ventas,
    costosBucket.costos,
  );
}
