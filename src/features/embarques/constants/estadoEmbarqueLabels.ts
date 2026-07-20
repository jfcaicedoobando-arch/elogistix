/**
 * v13.303.17 — Mapa de etiquetas visibles para los estados del embarque.
 *
 * Motivación: el enum `estado_embarque` en BD usa el valor `'Cotización'`
 * para el estado intermedio entre `Borrador` y `Confirmado`. Ese nombre
 * choca con el documento previo del módulo Cotizaciones (COT-XXXX), y en
 * el stepper del detalle se lee como si el embarque retrocediera a la
 * cotización.
 *
 * Solución cosmética: el valor de BD se mantiene ('Cotización'), pero en
 * la UI mostramos 'Propuesta'. La máquina de estados, RLS, RPCs y filtros
 * de datos siguen usando el valor original.
 */
import { ESTADOS_EMBARQUE } from "./embarqueConstants";

export type EstadoEmbarque = typeof ESTADOS_EMBARQUE[number];

export const ESTADO_EMBARQUE_LABELS: Record<string, string> = {
  Cotización: "Propuesta",
};

/**
 * Devuelve la etiqueta visible para un estado de embarque.
 * Hace fallback al valor original si no hay renombrado configurado.
 */
export function labelEstadoEmbarque(estado: string | null | undefined): string {
  if (!estado) return "";
  return ESTADO_EMBARQUE_LABELS[estado] ?? estado;
}
