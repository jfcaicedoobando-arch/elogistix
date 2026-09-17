/**
 * Totales agregados de reconciliación de costos.
 */
import { calcularDesviacionPct } from "./reconciliacionCostos.filas";
import type {
  FilaReconciliacion,
  ResumenPorEstatus,
  ResumenPorMoneda,
  ResumenReconciliacion,
} from "./reconciliacionCostos.tipos";

export function calcularResumen(filas: FilaReconciliacion[]): ResumenReconciliacion {
  let cot = 0, real = 0, sinFac = 0;
  for (const f of filas) {
    cot += f.cotizado;
    real += f.real_facturado;
    if (f.facturas.length === 0) sinFac += 1;
  }
  return {
    total_cotizado: cot,
    total_real: real,
    diferencia_total: real - cot,
    desviacion_pct_total: calcularDesviacionPct(cot, real),
    conceptos_sin_factura: sinFac,
  };
}

export function calcularResumenPorEstatus(filas: FilaReconciliacion[]): ResumenPorEstatus {
  const r: ResumenPorEstatus = { sin_match: 0, parcial: 0, conciliado: 0, excedente: 0 };
  for (const f of filas) r[f.estatus_renglon] += 1;
  return r;
}

/** Totales agrupados por moneda (los montos de distintas monedas no se suman). */
export function calcularResumenPorMoneda(filas: FilaReconciliacion[]): ResumenPorMoneda[] {
  const map = new Map<string, ResumenPorMoneda>();
  for (const f of filas) {
    const cur = map.get(f.moneda) ?? {
      moneda: f.moneda, cotizado: 0, real: 0, diferencia: 0, desviacion_pct: 0,
    };
    cur.cotizado += f.cotizado;
    cur.real += f.real_facturado;
    map.set(f.moneda, cur);
  }
  return Array.from(map.values()).map((m) => ({
    ...m,
    diferencia: m.real - m.cotizado,
    desviacion_pct: calcularDesviacionPct(m.cotizado, m.real),
  }));
}
