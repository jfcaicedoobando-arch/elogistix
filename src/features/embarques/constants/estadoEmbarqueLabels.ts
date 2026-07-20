/**
 * v13.303.21 — Mapa de etiquetas visibles para los estados del embarque.
 *
 * Historia:
 * - v13.303.17: renombramos cosméticamente `Cotización` → `Propuesta` para
 *   evitar la colisión con el documento comercial COT-XXXX en el stepper.
 * - v13.303.21: eliminamos el estado del workflow (Borrador salta directo a
 *   Confirmado). El valor `Cotización` sigue existiendo en el enum de BD
 *   como deprecado; si aparece por dato legacy, lo etiquetamos como
 *   "Propuesta (deprecado)" para que el operador identifique que debe
 *   avanzarlo o regresarlo.
 */
import { ESTADOS_EMBARQUE } from "./embarqueConstants";

export type EstadoEmbarque = typeof ESTADOS_EMBARQUE[number];

export const ESTADO_EMBARQUE_LABELS: Record<string, string> = {
  Cotización: "Propuesta (deprecado)",
};

/**
 * Devuelve la etiqueta visible para un estado de embarque.
 * Hace fallback al valor original si no hay renombrado configurado.
 */
export function labelEstadoEmbarque(estado: string | null | undefined): string {
  if (!estado) return "";
  return ESTADO_EMBARQUE_LABELS[estado] ?? estado;
}
