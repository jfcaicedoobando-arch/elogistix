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
import { rangoMes } from "@/lib/domain/proyeccionFacturacion";
import {
  buildEstadoResultados,
  type EstadoResultados,
  type EmbarqueER,
  type ConceptoVentaER,
  type ConceptoCostoER,
} from "@/lib/domain/estadoResultados";

interface Params {
  organizationId: string | null;
  year: number;
  month: number;
}

async function loadEmbarquesPorIds(ids: string[]): Promise<EmbarqueER[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("embarques")
    .select("id, modo, tipo_cambio_usd, tipo_cambio_eur")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as EmbarqueER[];
}

async function loadEmbarquesPorExpedientes(exps: string[]): Promise<Map<string, EmbarqueER>> {
  if (exps.length === 0) return new Map();
  const { data, error } = await supabase
    .from("embarques")
    .select("id, modo, tipo_cambio_usd, tipo_cambio_eur, expediente")
    .in("expediente", exps);
  if (error) throw error;
  const map = new Map<string, EmbarqueER>();
  for (const e of (data ?? []) as (EmbarqueER & { expediente?: string })[]) {
    if (e.expediente) map.set(e.expediente, e);
  }
  return map;
}

export async function fetchEstadoResultadosDevengado(p: Params): Promise<EstadoResultados> {
  const { desde, hasta } = rangoMes(p.year, p.month);

  // 1) Facturas emitidas en el mes (ingresos)
  let fq = supabase
    .from("facturas")
    .select("id, expediente, total, moneda, fecha_emision, tipo_cambio")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    .neq("estado", "Cancelada");
  if (p.organizationId) fq = fq.eq("organization_id", p.organizationId);
  const { data: facturas, error: fe } = await fq;
  if (fe) throw fe;

  // 2) Notas de crédito aplicadas en el mes (restan ingresos)
  let nq = supabase
    .from("factura_notas_credito")
    .select("monto, moneda, factura_id, updated_at")
    .eq("estado", "Aplicada")
    .gte("updated_at", `${desde}T00:00:00`)
    .lte("updated_at", `${hasta}T23:59:59`)
    .is("deleted_at", null);
  if (p.organizationId) nq = nq.eq("organization_id", p.organizationId);
  const { data: ncs, error: ne } = await nq;
  if (ne) throw ne;

  // 3) Facturas proveedor del mes (costos)
  let pq = supabase
    .from("proveedor_facturas")
    .select("id, embarque_id, total, moneda, fecha_emision, tipo_cambio_usd")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    .neq("estado", "Cancelada")
    .is("deleted_at", null);
  if (p.organizationId) pq = pq.eq("organization_id", p.organizationId);
  const { data: pfacts, error: pe } = await pq;
  if (pe) throw pe;

  // Resolución de embarque para asignar modo
  const exps = Array.from(new Set((facturas ?? []).map(f => f.expediente).filter(Boolean) as string[]));
  const embIds = Array.from(new Set((pfacts ?? []).map(f => f.embarque_id).filter(Boolean) as string[]));
  const [embPorExp, embPorId] = await Promise.all([
    loadEmbarquesPorExpedientes(exps),
    loadEmbarquesPorIds(embIds),
  ]);

  // Construcción de virtual-embarques + virtual-conceptos para reutilizar buildEstadoResultados
  const virtualEmbarques: EmbarqueER[] = [];
  const ventas: ConceptoVentaER[] = [];
  const costos: ConceptoCostoER[] = [];

  const fallbackTC = (tc: number | null) => tc && tc > 0 ? tc : 1;

  for (const f of facturas ?? []) {
    const emb = f.expediente ? embPorExp.get(f.expediente) : undefined;
    const id = `fact-${f.id}`;
    virtualEmbarques.push({
      id,
      modo: emb?.modo ?? "Marítimo",
      tipo_cambio_usd: emb?.tipo_cambio_usd ?? fallbackTC(Number(f.tipo_cambio)),
      tipo_cambio_eur: emb?.tipo_cambio_eur ?? 1,
    });
    ventas.push({
      embarque_id: id,
      descripcion: "Facturación",
      total: Number(f.total),
      moneda: String(f.moneda),
    });
  }

  for (const nc of ncs ?? []) {
    const id = `nc-${nc.factura_id}`;
    virtualEmbarques.push({ id, modo: "Marítimo", tipo_cambio_usd: 1, tipo_cambio_eur: 1 });
    ventas.push({
      embarque_id: id,
      descripcion: "Notas de crédito",
      total: -Math.abs(Number(nc.monto)),
      moneda: String(nc.moneda),
    });
  }

  for (const pf of pfacts ?? []) {
    const emb = pf.embarque_id ? embPorId.find(e => e.id === pf.embarque_id) : undefined;
    const id = `pf-${pf.id}`;
    virtualEmbarques.push({
      id,
      modo: emb?.modo ?? "Marítimo",
      tipo_cambio_usd: emb?.tipo_cambio_usd ?? fallbackTC(Number(pf.tipo_cambio_usd)),
      tipo_cambio_eur: emb?.tipo_cambio_eur ?? 1,
    });
    costos.push({
      embarque_id: id,
      concepto: "Facturas de proveedor",
      monto: Number(pf.total),
      moneda: String(pf.moneda),
    });
  }

  return buildEstadoResultados(virtualEmbarques, ventas, costos);
}
