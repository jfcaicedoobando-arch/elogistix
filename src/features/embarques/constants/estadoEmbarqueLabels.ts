/**
 * v13.303.22 — Mapa de etiquetas visibles para los estados del embarque.
 *
 * Historia:
 * - v13.303.17: renombramos cosméticamente `Cotización` → `Propuesta`.
 * - v13.303.21: eliminamos `Cotización` del workflow (rescate en UI).
 * - v13.303.22: reordenamos Arribo antes de En Aduana y sacamos `Llegada`
 *   del workflow. Ambos deprecados persisten en el enum de BD para no romper
 *   históricos y se etiquetan con el sufijo "(deprecado)" en pantalla.
 */

export const ESTADO_EMBARQUE_LABELS: Record<string, string> = {
  Cotización: "Propuesta (deprecado)",
  Llegada: "Llegada (deprecado)",
};

/**
 * Devuelve la etiqueta visible para un estado de embarque.
 * Hace fallback al valor original si no hay renombrado configurado.
 */
export function labelEstadoEmbarque(estado: string | null | undefined): string {
  if (!estado) return "";
  return ESTADO_EMBARQUE_LABELS[estado] ?? estado;
}
