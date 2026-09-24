/**
 * Totales agregados de reconciliación de costos.
 * Las filas `no_comparable` (factura ligada sin tipo de cambio) cuentan en el
 * presupuesto pero nunca en la variación: ni numerador ni denominador.
 */
import { calcularDesviacionPct } from "./reconciliacionCostos.filas";
import type {
  FilaReconciliacion,
  ResumenPorEstatus,
  ResumenPorMoneda,
  ResumenReconciliacion,
} from "./reconciliacionCostos.tipos";

export function esFilaNoComparable(f: FilaReconciliacion): boolean {
  return f.estatus_renglon === "no_comparable" || (f.vinculos_excluidos ?? 0) > 0;
}

interface Acum { cot: number; real: number; cotComp: number; realComp: number; comparables: number; pendientes: number; sinFactura: number }

/** P1-A: sin factura vinculada el real es 0 por falta de captura, no un ahorro. */
export function esFilaSinFactura(f: FilaReconciliacion): boolean {
  return f.estatus_renglon === "sin_match" || f.facturas.length === 0;
}

function acumular(filas: FilaReconciliacion[]): Acum {
  const a: Acum = { cot: 0, real: 0, cotComp: 0, realComp: 0, comparables: 0, pendientes: 0, sinFactura: 0 };
  for (const f of filas) {
    a.cot += f.cotizado;
    a.real += f.real_facturado;
    if (esFilaNoComparable(f)) { a.pendientes += 1; continue; }
    if (esFilaSinFactura(f)) { a.sinFactura += 1; continue; }
    a.comparables += 1;
    a.cotComp += f.cotizado;
    a.realComp += f.real_facturado;
  }
  return a;
}

function variacion(a: Acum): { diferencia: number | null; pct: number | null } {
  if (a.comparables === 0) return { diferencia: null, pct: null };
  return { diferencia: a.realComp - a.cotComp, pct: calcularDesviacionPct(a.cotComp, a.realComp) };
}

/** Ojo: no separa monedas; para mostrar montos usar `calcularResumenPorMoneda`. */
export function calcularResumen(filas: FilaReconciliacion[]): ResumenReconciliacion {
  const a = acumular(filas);
  const v = variacion(a);
  return {
    total_cotizado: a.cot,
    total_real: a.real,
    diferencia_total: v.diferencia,
    desviacion_pct_total: v.pct,
    pendientes_tc: a.pendientes,
    conceptos_sin_factura: a.sinFactura,
  };
}

export function calcularResumenPorEstatus(filas: FilaReconciliacion[]): ResumenPorEstatus {
  const r: ResumenPorEstatus = { sin_match: 0, parcial: 0, conciliado: 0, excedente: 0, no_comparable: 0 };
  for (const f of filas) r[f.estatus_renglon] += 1;
  return r;
}

/** Totales agrupados por moneda (los montos de distintas monedas no se suman). */
export function calcularResumenPorMoneda(filas: FilaReconciliacion[]): ResumenPorMoneda[] {
  const grupos = new Map<string, FilaReconciliacion[]>();
  for (const f of filas) grupos.set(f.moneda, [...(grupos.get(f.moneda) ?? []), f]);
  return Array.from(grupos.entries()).map(([moneda, fs]) => {
    const a = acumular(fs);
    const v = variacion(a);
    return {
      moneda, cotizado: a.cot, real: a.real,
      diferencia: v.diferencia, desviacion_pct: v.pct, pendientes_tc: a.pendientes, sin_factura: a.sinFactura,
    };
  });
}
