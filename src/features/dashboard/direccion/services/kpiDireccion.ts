/**
 * Servicio principal del Dashboard Dirección. Carga embarques + conceptos +
 * facturas + pagos y computa los KPIs ejecutivos en memoria. Todo en MXN.
 *
 * Los datos que aún no existen en el modelo (documentos vencidos) se devuelven
 * como `null` para que la UI muestre placeholder "sin datos".
 */
import { supabase } from "@/integrations/supabase/client";
import { calcularMargen, calcularUtilidad } from "@/lib/financial/financialUtils";
import { finMesUtc, inicioMesUtc, mxnFactura, toMxn, ym } from "./mxn";
import type {
  BucketAntiguedad, DireccionKpis, HeroKpis, MargenMes, MargenModo, PulsoKpis, TopCliente,
} from "./tipos";

type EmbarqueRow = {
  id: string; modo: string | null; estado: string | null; eta: string | null;
  cerrado_at: string | null; cliente_id: string | null; cliente_nombre: string | null;
  tipo_cambio_usd: number | null; tipo_cambio_eur: number | null;
};
type ConceptoVentaRow = { embarque_id: string; total: number | null; moneda: string | null };
type ConceptoCostoRow = { embarque_id: string; monto: number | null; moneda: string | null };
type FacturaRow = {
  id: string; total: number | null; moneda: string; tipo_cambio: number | null;
  fecha_emision: string; fecha_vencimiento: string | null; estado: string;
  cliente_id: string | null; timbrado_en: string | null; uuid_fiscal: string | null;
  acuse_cancelacion_status: string | null;
};
type PagoRow = {
  factura_id: string; monto_aplicado_factura: number | null; moneda: string;
  tipo_cambio: number | null; fecha_pago: string;
};

const HORIZONTE_MESES = 6;

async function loadEmbarques(orgId: string | null, desdeIso: string): Promise<{
  embarques: EmbarqueRow[]; ventas: ConceptoVentaRow[]; costos: ConceptoCostoRow[];
}> {
  let q = supabase.from("embarques")
    .select("id, modo, estado, eta, cerrado_at, cliente_id, cliente_nombre, tipo_cambio_usd, tipo_cambio_eur")
    .is("deleted_at", null)
    .or(`cerrado_at.gte.${desdeIso},eta.gte.${desdeIso}`)
    .limit(3000);
  if (orgId) q = q.eq("organization_id", orgId);
  const { data: embarques, error } = await q;
  if (error) throw error;
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

async function loadFacturas(orgId: string | null, desdeIso: string) {
  let qF = supabase.from("facturas")
    .select("id, total, moneda, tipo_cambio, fecha_emision, fecha_vencimiento, estado, cliente_id, timbrado_en, uuid_fiscal, acuse_cancelacion_status")
    .gte("fecha_emision", desdeIso).is("deleted_at", null).limit(10000);
  if (orgId) qF = qF.eq("organization_id", orgId);
  const { data: facturas, error } = await qF;
  if (error) throw error;
  const ids = (facturas ?? []).map((f) => f.id);
  if (ids.length === 0) return { facturas: [] as FacturaRow[], pagos: [] as PagoRow[] };
  const { data: pagos, error: e2 } = await supabase.from("pagos_factura")
    .select("factura_id, monto_aplicado_factura, moneda, tipo_cambio, fecha_pago")
    .in("factura_id", ids).is("deleted_at", null).limit(20000);
  if (e2) throw e2;
  return { facturas: (facturas ?? []) as FacturaRow[], pagos: (pagos ?? []) as PagoRow[] };
}

interface EmbarqueAgg { venta: number; costo: number; modo: string; cliente_id: string | null; cliente_nombre: string; mes: string }

function agregarEmbarques(
  embarques: EmbarqueRow[], ventas: ConceptoVentaRow[], costos: ConceptoCostoRow[],
): Map<string, EmbarqueAgg> {
  const map = new Map<string, EmbarqueAgg>();
  for (const e of embarques) {
    const fecha = e.cerrado_at ?? e.eta;
    if (!fecha) continue;
    map.set(e.id, {
      venta: 0, costo: 0,
      modo: e.modo ?? "Sin modo",
      cliente_id: e.cliente_id,
      cliente_nombre: e.cliente_nombre ?? "Sin cliente",
      mes: fecha.slice(0, 7),
    });
  }
  const tcById = new Map(embarques.map((e) => [e.id, { usd: Number(e.tipo_cambio_usd) || 1, eur: Number(e.tipo_cambio_eur) || 1 }]));
  for (const v of ventas) {
    const agg = map.get(v.embarque_id); if (!agg) continue;
    const tc = tcById.get(v.embarque_id)!;
    agg.venta += toMxn(v.total, v.moneda, tc.usd, tc.eur);
  }
  for (const c of costos) {
    const agg = map.get(c.embarque_id); if (!agg) continue;
    const tc = tcById.get(c.embarque_id)!;
    agg.costo += toMxn(c.monto, c.moneda, tc.usd, tc.eur);
  }
  return map;
}

function calcularMargen6m(aggs: EmbarqueAgg[], hoy: Date): MargenMes[] {
  const base = inicioMesUtc(hoy);
  const meses: MargenMes[] = [];
  for (let i = HORIZONTE_MESES - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    const key = ym(d);
    const rel = aggs.filter((a) => a.mes === key);
    const v = rel.reduce((s, a) => s + a.venta, 0);
    const c = rel.reduce((s, a) => s + a.costo, 0);
    meses.push({ mes: key, margen_pct: calcularMargen(v, c), utilidad_mxn: calcularUtilidad(v, c) });
  }
  return meses;
}

function calcularMargenPorModo(aggs: EmbarqueAgg[]): MargenModo[] {
  const byModo = new Map<string, { venta: number; costo: number }>();
  for (const a of aggs) {
    const cur = byModo.get(a.modo) ?? { venta: 0, costo: 0 };
    cur.venta += a.venta; cur.costo += a.costo;
    byModo.set(a.modo, cur);
  }
  return Array.from(byModo.entries())
    .map(([modo, { venta, costo }]) => ({ modo, margen_pct: calcularMargen(venta, costo), venta_mxn: venta }))
    .sort((a, b) => b.venta_mxn - a.venta_mxn);
}

function calcularTopClientes(aggs: EmbarqueAgg[]): TopCliente[] {
  const byCliente = new Map<string, { id: string | null; nombre: string; utilidad: number }>();
  for (const a of aggs) {
    const key = a.cliente_id ?? `n:${a.cliente_nombre}`;
    const cur = byCliente.get(key) ?? { id: a.cliente_id, nombre: a.cliente_nombre, utilidad: 0 };
    cur.utilidad += a.venta - a.costo;
    byCliente.set(key, cur);
  }
  const arr = Array.from(byCliente.values()).sort((a, b) => b.utilidad - a.utilidad);
  const totalPos = arr.reduce((s, x) => s + Math.max(0, x.utilidad), 0);
  return arr.slice(0, 5).map((x) => ({
    cliente_id: x.id,
    cliente_nombre: x.nombre,
    utilidad_mxn: x.utilidad,
    pct: totalPos > 0 ? (Math.max(0, x.utilidad) / totalPos) * 100 : 0,
  }));
}

function calcularAntiguedad(facturas: FacturaRow[], pagos: PagoRow[], fallbackUsd: number, hoy: Date): BucketAntiguedad[] {
  const saldoById = new Map<string, number>();
  for (const f of facturas) {
    if (f.estado === "Cancelada") continue;
    saldoById.set(f.id, mxnFactura(Number(f.total ?? 0), f.moneda, f.tipo_cambio, fallbackUsd));
  }
  for (const p of pagos) {
    const s = saldoById.get(p.factura_id);
    if (s === undefined) continue;
    const abono = mxnFactura(Number(p.monto_aplicado_factura ?? 0), p.moneda, p.tipo_cambio, fallbackUsd);
    saldoById.set(p.factura_id, s - abono);
  }
  const buckets: Record<BucketAntiguedad["bucket"], BucketAntiguedad> = {
    "Corriente": { bucket: "Corriente", monto_mxn: 0, facturas: 0 },
    "1-30": { bucket: "1-30", monto_mxn: 0, facturas: 0 },
    "31-60": { bucket: "31-60", monto_mxn: 0, facturas: 0 },
    "+60": { bucket: "+60", monto_mxn: 0, facturas: 0 },
  };
  const hoyMs = hoy.getTime();
  for (const f of facturas) {
    const saldo = saldoById.get(f.id) ?? 0;
    if (saldo <= 0.5) continue;
    const venc = f.fecha_vencimiento ? new Date(`${f.fecha_vencimiento}T00:00:00Z`).getTime() : hoyMs;
    const dias = Math.floor((hoyMs - venc) / 86_400_000);
    const key: BucketAntiguedad["bucket"] = dias <= 0 ? "Corriente" : dias <= 30 ? "1-30" : dias <= 60 ? "31-60" : "+60";
    buckets[key].monto_mxn += saldo;
    buckets[key].facturas += 1;
  }
  return [buckets.Corriente, buckets["1-30"], buckets["31-60"], buckets["+60"]];
}

function calcularHero(
  aggs: EmbarqueAgg[], facturas: FacturaRow[], antiguedad: BucketAntiguedad[],
  fallbackUsd: number, hoy: Date, mesActual: string, mesPrev: string,
): HeroKpis {
  const actuales = aggs.filter((a) => a.mes === mesActual);
  const previos = aggs.filter((a) => a.mes === mesPrev);
  const v = actuales.reduce((s, a) => s + a.venta, 0);
  const c = actuales.reduce((s, a) => s + a.costo, 0);
  const vP = previos.reduce((s, a) => s + a.venta, 0);
  const cP = previos.reduce((s, a) => s + a.costo, 0);
  const facturado_mes_mxn = facturas
    .filter((f) => f.estado !== "Cancelada" && f.fecha_emision.slice(0, 7) === mesActual)
    .reduce((s, f) => s + mxnFactura(Number(f.total ?? 0), f.moneda, f.tipo_cambio, fallbackUsd), 0);
  const vencidas = facturas.filter((f) => {
    if (f.estado === "Cancelada" || f.estado === "Pagada") return false;
    if (!f.fecha_vencimiento) return false;
    return new Date(`${f.fecha_vencimiento}T00:00:00Z`).getTime() < hoy.getTime();
  });
  const clientesVencidos = new Set(vencidas.map((f) => f.cliente_id).filter(Boolean));
  const carteraVencida = antiguedad.filter((b) => b.bucket !== "Corriente").reduce((s, b) => s + b.monto_mxn, 0);
  return {
    utilidad_mxn: calcularUtilidad(v, c),
    venta_mxn: v, costo_mxn: c,
    margen_pct: calcularMargen(v, c),
    margen_pct_prev: calcularMargen(vP, cP),
    cartera_vencida_mxn: carteraVencida,
    cartera_vencida_clientes: clientesVencidos.size,
    facturado_mes_mxn,
  };
}

async function calcularPulso(orgId: string | null, facturas: FacturaRow[], hoy: Date, mesActual: string): Promise<PulsoKpis> {
  let q = supabase.from("embarques")
    .select("estado, eta")
    .is("deleted_at", null)
    .not("estado", "in", "(Entregado,Cancelado)")
    .limit(3000);
  if (orgId) q = q.eq("organization_id", orgId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Array<{ estado: string | null; eta: string | null }>;
  const porEstado = new Map<string, number>();
  const en7d = new Date(hoy.getTime() + 7 * 86_400_000);
  let arribos_7d = 0; let demoras = 0;
  for (const r of rows) {
    const est = r.estado ?? "Sin estado";
    porEstado.set(est, (porEstado.get(est) ?? 0) + 1);
    if (r.eta) {
      const eta = new Date(`${r.eta}T00:00:00Z`);
      if (eta >= hoy && eta <= en7d) arribos_7d += 1;
      if (est === "En Aduana" && eta < hoy) demoras += 1;
    }
  }
  const cfdi_timbrados_mes = facturas.filter((f) => f.uuid_fiscal && f.timbrado_en && f.timbrado_en.slice(0, 7) === mesActual).length;
  const acuses_pendientes = facturas.filter((f) => f.estado === "Cancelada" && (f.acuse_cancelacion_status ?? "") !== "aceptado").length;
  return {
    embarques_activos: rows.length,
    embarques_por_estado: Array.from(porEstado.entries()).map(([estado, total]) => ({ estado, total })).sort((a, b) => b.total - a.total),
    arribos_7d, demoras,
    documentos_vencidos: null,
    cfdi_timbrados_mes, acuses_pendientes,
  };
}

export async function fetchDireccionKpis(
  orgId: string | null, fallbackUsdMxn: number, hoy: Date = new Date(),
): Promise<DireccionKpis> {
  const base = inicioMesUtc(hoy);
  const desde = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - (HORIZONTE_MESES - 1), 1));
  const desdeIso = desde.toISOString().slice(0, 10);
  const mesActual = ym(base);
  const mesPrev = ym(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1)));

  const [{ embarques, ventas, costos }, { facturas, pagos }] = await Promise.all([
    loadEmbarques(orgId, desdeIso),
    loadFacturas(orgId, desdeIso),
  ]);

  const aggMap = agregarEmbarques(embarques, ventas, costos);
  const aggs = Array.from(aggMap.values());
  const _finMes = finMesUtc(hoy); void _finMes;

  const margen_6m = calcularMargen6m(aggs, hoy);
  const margen_por_modo = calcularMargenPorModo(aggs.filter((a) => a.mes === mesActual));
  const antiguedad = calcularAntiguedad(facturas, pagos, fallbackUsdMxn, hoy);
  const top_clientes = calcularTopClientes(aggs.filter((a) => a.mes === mesActual));
  const hero = calcularHero(aggs, facturas, antiguedad, fallbackUsdMxn, hoy, mesActual, mesPrev);
  const pulso = await calcularPulso(orgId, facturas, hoy, mesActual);

  return { hero, margen_6m, margen_por_modo, antiguedad, top_clientes, pulso };
}
