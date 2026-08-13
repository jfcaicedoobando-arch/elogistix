/**
 * Desviación del tipo de cambio capturado respecto a una referencia (DOF).
 * Función pura, sin React ni Supabase (v13.554.1: separada del componente
 * para no romper Fast Refresh).
 */

/** Desviación porcentual del valor capturado respecto a la referencia. */
export function desviacionTcPct(capturado: number, referencia: number): number | null {
  if (!(capturado > 0) || !(referencia > 0)) return null;
  return ((capturado - referencia) / referencia) * 100;
}
