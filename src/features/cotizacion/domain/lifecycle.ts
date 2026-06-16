/**
 * Reglas de ciclo de vida de cotizaciones.
 *
 * Centraliza los plazos y helpers usados tanto en BD (`expirar_cotizaciones_job`)
 * como en UI (filtros, banners). Si en el futuro se vuelven configurables por
 * organización, basta con migrar estas constantes a `configuracion_global`.
 */

/** Días de vida de una cotización en estado "Borrador" antes de marcarla "Vencida". */
export const DIAS_EXPIRACION_BORRADOR = 7;

/** Días después de "Vencida" antes de pasar a "Archivada" (oculta por defecto). */
export const DIAS_PARA_ARCHIVAR = 90;

/** Estados que NO aparecen en el listado por defecto (housekeeping). */
export const ESTADOS_INACTIVOS = ["Vencida", "Archivada"] as const;

export type EstadoInactivo = typeof ESTADOS_INACTIVOS[number];

/** Indica si el estado actual es inactivo (oculto del listado por defecto). */
export function estaInactiva(estado: string | null | undefined): boolean {
  if (!estado) return false;
  return (ESTADOS_INACTIVOS as readonly string[]).includes(estado);
}

/** Solo se puede reactivar desde un estado inactivo. */
export function puedeReactivar(estado: string | null | undefined): boolean {
  return estaInactiva(estado);
}
