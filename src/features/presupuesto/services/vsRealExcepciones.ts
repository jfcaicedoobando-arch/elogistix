import { UMBRAL_SOBREEJERCICIO_PCT } from "../constants";
import type { FilaVsReal } from "./vsRealDomain";

/** Base cero no admite porcentaje: se muestra como excepción independiente. */
export function tieneGastoSinPresupuesto(fila: FilaVsReal): boolean {
  return fila.presupuesto_mxn === 0 && fila.real_mxn > 0;
}

export function esExcepcionVsReal(fila: FilaVsReal): boolean {
  return tieneGastoSinPresupuesto(fila)
    || (fila.presupuesto_mxn > 0 && fila.cumplimiento_pct > UMBRAL_SOBREEJERCICIO_PCT);
}

export function etiquetaGastoSinPresupuesto(fila: FilaVsReal): string {
  if (fila.presupuesto_capturado === true) return "Gasto con presupuesto cero";
  if (fila.presupuesto_capturado === false) return "Gasto sin captura de presupuesto";
  return "Gasto sin presupuesto";
}
