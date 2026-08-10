/**
 * Cálculos puros del Dashboard Dirección — sin I/O, sin React, testeables.
 */
import { calcularMargen, calcularUtilidad } from "@/lib/financial/financialUtils";
import { inicioMesUtc, mxnFactura, toMxn, ym } from "./mxn";
import type {
  ConceptoCostoRow, ConceptoVentaRow, EmbarqueEstadoRow, EmbarqueRow, FacturaRow, PagoRow,
} from "./loaders";
import type {
  BucketAntiguedad, HeroKpis, MargenMes, MargenModo, PulsoKpis, TopCliente,
} from "./tipos";

const HORIZONTE_MESES = 6;

export interface EmbarqueAgg {
  venta: number; costo: number; modo: string;
  cliente_id: string | null; cliente_nombre: string; mes: string;
}

interface TcEmbarque { usd: number; eur: number }

/**
 * Ola 4 · N40: la guardia valida el TC de la MONEDA DEL CONCEPTO. Antes un
 * concepto EUR se aceptaba/descartaba según el TC USD y terminaba valuado con
 * el tipo de cambio equivocado (o descartado teniendo TC EUR válido).
 */
function tcAplicable(moneda: string | null | undefined, t: TcEmbarque): number {
  const m = (moneda ?? "MXN").toUpperCase();
  if (m === "MXN") return 1;
  return m === "EUR" ? t.eur : t.usd;
}

function mapaTc(embarques: EmbarqueRow[]): Map<string, TcEmbarque> {
  // FIX-11 (Fase 4): sin fallback silencioso a TC=1. Si el embarque no tiene
  // TC capturado, sólo agregamos filas ya en MXN; USD/EUR se ignoran para no
  // inflar la utilidad. El dashboard exhibe el hueco vía `facturas_sin_tc`.
  return new Map(embarques.map((e) => {
    const usd = Number(e.tipo_cambio_usd);
    const eur = Number(e.tipo_cambio_eur);
    return [e.id, {
      usd: Number.isFinite(usd) && usd > 0 ? usd : 0,
      eur: Number.isFinite(eur) && eur > 0 ? eur : 0,
    }];
  }));
}

export function agregarEmbarques(
  embarques: EmbarqueRow[], ventas: ConceptoVentaRow[], costos: ConceptoCostoRow[],
): EmbarqueAgg[] {
  const map = new Map<string, EmbarqueAgg>();
  for (const e of embarques) {
    const fecha = e.cerrado_at ?? e.eta;
    if (!fecha) continue;
    map.set(e.id, {
      venta: 0, costo: 0, modo: e.modo ?? "Sin modo",
      cliente_id: e.cliente_id, cliente_nombre: e.cliente_nombre ?? "Sin cliente",
      mes: fecha.slice(0, 7),
    });
  }
  const tc = mapaTc(embarques);
  for (const v of ventas) {
    const a = map.get(v.embarque_id); if (!a) continue;
    const t = tc.get(v.embarque_id)!;
    if (tcAplicable(v.moneda, t) <= 0) continue;
    a.venta += toMxn(v.total, v.moneda, t.usd, t.eur);
  }
  for (const c of costos) {
    const a = map.get(c.embarque_id); if (!a) continue;
    const t = tc.get(c.embarque_id)!;
    if (tcAplicable(c.moneda, t) <= 0) continue;
    a.costo += toMxn(c.monto, c.moneda, t.usd, t.eur);
  }

  return Array.from(map.values());
}

export function calcularMargen6m(aggs: EmbarqueAgg[], hoy: Date): MargenMes[] {
  const base = inicioMesUtc(hoy);
  const out: MargenMes[] = [];
  for (let i = HORIZONTE_MESES - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    const key = ym(d);
    const rel = aggs.filter((a) => a.mes === key);
    const v = rel.reduce((s, a) => s + a.venta, 0);
    const c = rel.reduce((s, a) => s + a.costo, 0);
    out.push({ mes: key, margen_pct: calcularMargen(v, c), utilidad_mxn: calcularUtilidad(v, c) });
  }
  return out;
}

export function calcularMargenPorModo(aggs: EmbarqueAgg[]): MargenModo[] {
  const by = new Map<string, { venta: number; costo: number }>();
  for (const a of aggs) {
    const cur = by.get(a.modo) ?? { venta: 0, costo: 0 };
    cur.venta += a.venta; cur.costo += a.costo;
    by.set(a.modo, cur);
  }
  return Array.from(by.entries())
    .map(([modo, { venta, costo }]) => ({ modo, margen_pct: calcularMargen(venta, costo), venta_mxn: venta }))
    .sort((a, b) => b.venta_mxn - a.venta_mxn);
}

export function calcularTopClientes(aggs: EmbarqueAgg[]): TopCliente[] {
  const by = new Map<string, { id: string | null; nombre: string; utilidad: number }>();
  for (const a of aggs) {
    const key = a.cliente_id ?? `n:${a.cliente_nombre}`;
    const cur = by.get(key) ?? { id: a.cliente_id, nombre: a.cliente_nombre, utilidad: 0 };
    cur.utilidad += a.venta - a.costo;
    by.set(key, cur);
  }
  const arr = Array.from(by.values()).sort((a, b) => b.utilidad - a.utilidad);
  const totalPos = arr.reduce((s, x) => s + Math.max(0, x.utilidad), 0);
  return arr.slice(0, 5).map((x) => ({
    cliente_id: x.id, cliente_nombre: x.nombre, utilidad_mxn: x.utilidad,
    pct: totalPos > 0 ? (Math.max(0, x.utilidad) / totalPos) * 100 : 0,
  }));
}

export function calcularAntiguedad(facturas: FacturaRow[], pagos: PagoRow[], fallbackUsd: number, hoy: Date): BucketAntiguedad[] {
  const saldo = new Map<string, number>();
  for (const f of facturas) {
    if (f.estado === "Cancelada") continue;
    saldo.set(f.id, mxnFactura(Number(f.total ?? 0), f.moneda, f.tipo_cambio, fallbackUsd));
  }
  for (const p of pagos) {
    const s = saldo.get(p.factura_id); if (s === undefined) continue;
    saldo.set(p.factura_id, s - mxnFactura(Number(p.monto_aplicado_factura ?? 0), p.moneda, p.tipo_cambio, fallbackUsd));
  }
  const buckets: Record<BucketAntiguedad["bucket"], BucketAntiguedad> = {
    "Corriente": { bucket: "Corriente", monto_mxn: 0, facturas: 0 },
    "1-30": { bucket: "1-30", monto_mxn: 0, facturas: 0 },
    "31-60": { bucket: "31-60", monto_mxn: 0, facturas: 0 },
    "+60": { bucket: "+60", monto_mxn: 0, facturas: 0 },
  };
  for (const f of facturas) {
    const s = saldo.get(f.id) ?? 0;
    if (s <= 0.5) continue;
    const venc = f.fecha_vencimiento ? new Date(`${f.fecha_vencimiento}T00:00:00Z`).getTime() : hoy.getTime();
    const dias = Math.floor((hoy.getTime() - venc) / 86_400_000);
    const key: BucketAntiguedad["bucket"] = dias <= 0 ? "Corriente" : dias <= 30 ? "1-30" : dias <= 60 ? "31-60" : "+60";
    buckets[key].monto_mxn += s; buckets[key].facturas += 1;
  }
  return [buckets.Corriente, buckets["1-30"], buckets["31-60"], buckets["+60"]];
}

export interface CalcularHeroParams {
  aggs: EmbarqueAgg[]; facturas: FacturaRow[]; antiguedad: BucketAntiguedad[];
  fallbackUsd: number; hoy: Date; mesActual: string; mesPrev: string;
}

export function calcularHero(params: CalcularHeroParams): HeroKpis {
  const { aggs, facturas, antiguedad, fallbackUsd, hoy, mesActual, mesPrev } = params;
  const cur = aggs.filter((a) => a.mes === mesActual);
  const prev = aggs.filter((a) => a.mes === mesPrev);
  const v = cur.reduce((s, a) => s + a.venta, 0);
  const c = cur.reduce((s, a) => s + a.costo, 0);
  const vP = prev.reduce((s, a) => s + a.venta, 0);
  const cP = prev.reduce((s, a) => s + a.costo, 0);
  const facturado = facturas
    .filter((f) => f.estado !== "Cancelada" && f.fecha_emision.slice(0, 7) === mesActual)
    .reduce((s, f) => s + mxnFactura(Number(f.total ?? 0), f.moneda, f.tipo_cambio, fallbackUsd), 0);
  const vencidas = facturas.filter((f) => {
    if (f.estado === "Cancelada" || f.estado === "Pagada") return false;
    if (!f.fecha_vencimiento) return false;
    return new Date(`${f.fecha_vencimiento}T00:00:00Z`).getTime() < hoy.getTime();
  });
  const clientes = new Set(vencidas.map((f) => f.cliente_id).filter(Boolean));
  const vencidoTotal = antiguedad.filter((b) => b.bucket !== "Corriente").reduce((s, b) => s + b.monto_mxn, 0);
  return {
    utilidad_mxn: calcularUtilidad(v, c), venta_mxn: v, costo_mxn: c,
    margen_pct: calcularMargen(v, c), margen_pct_prev: calcularMargen(vP, cP),
    cartera_vencida_mxn: vencidoTotal, cartera_vencida_clientes: clientes.size,
    facturado_mes_mxn: facturado,
  };
}

export function calcularPulso(
  activos: EmbarqueEstadoRow[], facturas: FacturaRow[], hoy: Date, mesActual: string,
): PulsoKpis {
  const porEstado = new Map<string, number>();
  const en7d = new Date(hoy.getTime() + 7 * 86_400_000);
  let arribos_7d = 0; let demoras = 0;
  for (const r of activos) {
    const est = r.estado ?? "Sin estado";
    porEstado.set(est, (porEstado.get(est) ?? 0) + 1);
    if (r.eta) {
      // Ola 4 · N21: comparar por DÍA. `hoy` es un instante, así que un ETA de
      // hoy quedaba fuera de "arribos 7d" y cualquier ETA de hoy contaba como
      // demora desde la medianoche. La demora exige > 7 días de retraso.
      const etaDia = r.eta.slice(0, 10);
      const hoyDia = hoy.toISOString().slice(0, 10);
      const en7dDia = en7d.toISOString().slice(0, 10);
      if (etaDia >= hoyDia && etaDia <= en7dDia) arribos_7d += 1;
      const diasRetraso = Math.floor(
        (Date.parse(`${hoyDia}T00:00:00Z`) - Date.parse(`${etaDia}T00:00:00Z`)) / 86_400_000,
      );
      if (est === "En Aduana" && diasRetraso > 7) demoras += 1;
    }
  }
  const cfdi = facturas.filter((f) => f.uuid_fiscal && f.timbrado_en && f.timbrado_en.slice(0, 7) === mesActual).length;
  const acuses = facturas.filter((f) => f.estado === "Cancelada" && (f.acuse_cancelacion_status ?? "") !== "aceptado").length;
  return {
    embarques_activos: activos.length,
    embarques_por_estado: Array.from(porEstado.entries()).map(([estado, total]) => ({ estado, total })).sort((a, b) => b.total - a.total),
    arribos_7d, demoras, documentos_vencidos: null,
    cfdi_timbrados_mes: cfdi, acuses_pendientes: acuses,
  };
}
