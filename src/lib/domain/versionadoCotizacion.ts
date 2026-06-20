/**
 * Dominio puro: versionado de cotizaciones y reconciliación a 3 columnas.
 *
 * Sin dependencias de Supabase o React. Toda la matemática vive aquí para que
 * pueda probarse de forma aislada y respetar la regla "centralizar matemática".
 *
 * Glosario de columnas:
 * - cotizado:     monto que el cliente aceptó (versión `version_aceptada`).
 * - refrescado:   monto al crear el embarque (Fase 1, tarifa vigente).
 * - real:         monto efectivamente registrado en `conceptos_costo`.
 */

export type ClasificacionVarianza = "dentro_rango" | "alerta" | "critica";

export interface UmbralesVarianza {
  /** % a partir del cual una varianza pasa de "dentro_rango" a "alerta". */
  alerta_pct: number;
  /** % a partir del cual una varianza pasa a "critica". */
  critica_pct: number;
}

export const UMBRALES_DEFAULT: UmbralesVarianza = {
  alerta_pct: 5,
  critica_pct: 15,
};

export interface DeltaPair {
  abs: number;
  pct: number;
}

export interface FilaReconciliacion3C {
  concepto: string;
  moneda: string;
  cotizado: number;
  refrescado: number;
  real: number;
  delta_cot_vs_real: DeltaPair;
  delta_cot_vs_refr: DeltaPair;
  delta_refr_vs_real: DeltaPair;
  /** Clasificación de la varianza más severa (cot vs real). */
  clasificacion: ClasificacionVarianza;
}

export interface ResumenReconciliacion3C {
  total_cotizado: number;
  total_refrescado: number;
  total_real: number;
  delta_cot_vs_real: DeltaPair;
  clasificacion: ClasificacionVarianza;
}

/** % absoluto entre dos montos. base=0 → 0 si actual=0, sino 100. */
export function calcularDeltaPct(base: number, actual: number): number {
  if (base === 0) return actual === 0 ? 0 : 100;
  return ((actual - base) / base) * 100;
}

export function calcularDelta(base: number, actual: number): DeltaPair {
  return { abs: actual - base, pct: calcularDeltaPct(base, actual) };
}

export function clasificarVarianza(
  deltaPct: number,
  umbrales: UmbralesVarianza = UMBRALES_DEFAULT,
): ClasificacionVarianza {
  const abs = Math.abs(deltaPct);
  if (abs >= umbrales.critica_pct) return "critica";
  if (abs >= umbrales.alerta_pct) return "alerta";
  return "dentro_rango";
}

export interface EntradaReconciliacion {
  concepto: string;
  moneda: string;
  cotizado: number;
  refrescado: number;
  real: number;
}

export function construirFilaReconciliacion(
  entrada: EntradaReconciliacion,
  umbrales: UmbralesVarianza = UMBRALES_DEFAULT,
): FilaReconciliacion3C {
  const deltaCR = calcularDelta(entrada.cotizado, entrada.real);
  const deltaCRefr = calcularDelta(entrada.cotizado, entrada.refrescado);
  const deltaRR = calcularDelta(entrada.refrescado, entrada.real);
  return {
    concepto: entrada.concepto,
    moneda: entrada.moneda,
    cotizado: entrada.cotizado,
    refrescado: entrada.refrescado,
    real: entrada.real,
    delta_cot_vs_real: deltaCR,
    delta_cot_vs_refr: deltaCRefr,
    delta_refr_vs_real: deltaRR,
    clasificacion: clasificarVarianza(deltaCR.pct, umbrales),
  };
}

export function construirResumen(
  filas: FilaReconciliacion3C[],
  umbrales: UmbralesVarianza = UMBRALES_DEFAULT,
): ResumenReconciliacion3C {
  const total_cotizado = filas.reduce((s, f) => s + f.cotizado, 0);
  const total_refrescado = filas.reduce((s, f) => s + f.refrescado, 0);
  const total_real = filas.reduce((s, f) => s + f.real, 0);
  const delta = calcularDelta(total_cotizado, total_real);
  return {
    total_cotizado,
    total_refrescado,
    total_real,
    delta_cot_vs_real: delta,
    clasificacion: clasificarVarianza(delta.pct, umbrales),
  };
}

export class CotizacionYaAceptadaError extends Error {
  constructor(message = "La cotización ya fue aceptada; debe re-cotizarse para modificarla.") {
    super(message);
    this.name = "CotizacionYaAceptadaError";
  }
}

export class MotivoRequeridoError extends Error {
  constructor(message = "Debe indicar un motivo para re-cotizar.") {
    super(message);
    this.name = "MotivoRequeridoError";
  }
}
