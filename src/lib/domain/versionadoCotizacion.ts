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

import { convertirMxn, type TiposCambio } from "@/lib/financial/convertir";
import { roundMoney } from "@/lib/financial/financialUtils";

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
  /** Moneda de los totales: SIEMPRE MXN (los renglones se normalizan). */
  moneda_total: "MXN";
  /** Renglones excluidos por falta de tipo de cambio para su moneda. */
  filas_sin_tipo_cambio: number;
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

/**
 * Auditoría 2026-08-28 · Hallazgo 3: los renglones vienen agrupados por
 * (concepto, moneda), así que sumarlos en crudo mezclaba USD, MXN y EUR en un
 * mismo total (y la UI lo rotulaba "USD"). Ahora TODO se normaliza a MXN con el
 * TC del embarque; un renglón en moneda extranjera sin TC se excluye y se
 * reporta en `filas_sin_tipo_cambio` en lugar de sumarse como si fueran pesos.
 */
export function construirResumen(
  filas: FilaReconciliacion3C[],
  umbrales: UmbralesVarianza = UMBRALES_DEFAULT,
  tc: TiposCambio = {},
): ResumenReconciliacion3C {
  let total_cotizado = 0;
  let total_refrescado = 0;
  let total_real = 0;
  let filas_sin_tipo_cambio = 0;

  for (const f of filas) {
    const cot = convertirMxn(f.cotizado, f.moneda, tc);
    const refr = convertirMxn(f.refrescado, f.moneda, tc);
    const real = convertirMxn(f.real, f.moneda, tc);
    if (cot.mxn === null || refr.mxn === null || real.mxn === null) {
      filas_sin_tipo_cambio += 1;
      continue;
    }
    total_cotizado += cot.mxn;
    total_refrescado += refr.mxn;
    total_real += real.mxn;
  }

  total_cotizado = roundMoney(total_cotizado);
  total_refrescado = roundMoney(total_refrescado);
  total_real = roundMoney(total_real);
  const delta = calcularDelta(total_cotizado, total_real);
  return {
    total_cotizado,
    total_refrescado,
    total_real,
    delta_cot_vs_real: delta,
    clasificacion: clasificarVarianza(delta.pct, umbrales),
    moneda_total: "MXN",
    filas_sin_tipo_cambio,
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

/**
 * La cotización tiene un embarque vivo vinculado, así que no puede re-cotizarse
 * (Bug 15). El expediente se preserva para mostrar contexto en la UI.
 */
export class CotizacionConEmbarqueError extends Error {
  readonly expediente: string;
  constructor(expediente: string) {
    super(
      expediente
        ? `Esta cotización ya está vinculada al embarque ${expediente}. Elimina el embarque antes de re-cotizar.`
        : "Esta cotización ya está vinculada a un embarque activo.",
    );
    this.name = "CotizacionConEmbarqueError";
    this.expediente = expediente;
  }
}
