/**
 * Regla del aviso de estado divergente (P2-6.5).
 *
 * Vive fuera del componente para que el archivo del componente sólo exporte
 * componentes (regla react-refresh/only-export-components).
 */

/** ¿Hay divergencia que valga la pena avisar? */
export function hayDivergenciaEstado(estadoVisual: string, estadoGuardado: string): boolean {
  return Boolean(estadoVisual) && Boolean(estadoGuardado) && estadoVisual !== estadoGuardado;
}
