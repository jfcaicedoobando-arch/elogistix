/**
 * FP-000221 — dominio del monto máximo autorizable sin liga a embarque.
 * Vive fuera del componente para no romper Fast Refresh.
 */

/** Mismo valor por defecto que la función de base `cxp_umbral_sin_vinculo`. */
export const UMBRAL_APROBACION_SIN_VINCULO_DEFAULT = 50000;

export function esUmbralValido(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0;
}
