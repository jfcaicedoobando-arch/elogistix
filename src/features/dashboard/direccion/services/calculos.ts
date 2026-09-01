/**
 * Cálculos puros del Dashboard Dirección — sin I/O, sin React, testeables.
 */
import { calcularMargen, calcularUtilidad } from "@/lib/financial/financialUtils";
import { HORIZONTE_MESES_DIRECCION, mesMasOffset, mesNegocio, toMxn } from "./mxn";
import type {
  ConceptoCostoRow, ConceptoVentaRow, EmbarqueRow,
} from "./loaders";
import type { MargenMes, MargenModo, TopCliente } from "./tipos";



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
  // P1 fecha de negocio: la serie se arma con aritmética mensual pura sobre el
  // mes de México, no con meses UTC (antes cambiaba de mes a las 18:00 CDMX).
  const mesActual = mesNegocio(hoy);
  const out: MargenMes[] = [];
  for (let i = HORIZONTE_MESES_DIRECCION - 1; i >= 0; i--) {
    const key = mesMasOffset(mesActual, -i);
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

export {
  calcularAntiguedad,
  calcularHero,
  calcularPulso,
} from "./calculosCartera";
