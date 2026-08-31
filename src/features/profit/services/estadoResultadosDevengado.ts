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
import {
  buildEstadoResultados,
  type EstadoResultados,
  type EmbarqueER,
  type ConceptoVentaER,
  type ConceptoCostoER,
} from "@/features/profit/domain/estadoResultados";
import type { FacturaRow, NotaCreditoRow } from "@/lib/mappers/estadoResultadosRows";
import {
  fetchFacturasMes,
  fetchNotasCreditoMes,
  fetchProveedorFacturasMes,
  loadEmbarquesPorExpedientes,
  loadEmbarquesPorIds,
} from "@/features/profit/services/estadoResultadosFetch";

interface Params {
  organizationId: string | null;
  year: number;
  month: number;
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
