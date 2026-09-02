/**
 * Estados de embarque que NO representan una realidad contable: `Cotización`
 * y `Borrador` (aún no confirmados) y `Cancelado` (revertido). Ningún reporte
 * financiero (Estado de Resultados, KPIs, exportaciones) debe sumarlos.
 *
 * Single source of truth: si se agrega un estado no financiero nuevo al enum
 * `estado_embarque`, añadirlo aquí también.
 */
export const ESTADOS_EMBARQUE_NO_CONTABLES = ["Cotización", "Borrador", "Cancelado"] as const;

export function esEstadoEmbarqueContable(estado: string | null | undefined): boolean {
  return !!estado && !ESTADOS_EMBARQUE_NO_CONTABLES.includes(estado as never);
}
