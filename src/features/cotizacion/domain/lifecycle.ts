/**
 * Reglas de ciclo de vida de cotizaciones.
 *
 * Centraliza los plazos y helpers usados tanto en BD (`expirar_cotizaciones_job`)
 * como en UI (filtros, banners). Si en el futuro se vuelven configurables por
 * organización, basta con migrar estas constantes a `configuracion_global`.
 */

/** Estados que NO aparecen en el listado por defecto (housekeeping). */
export const ESTADOS_INACTIVOS = ["Vencida", "Archivada"] as const;

/** Indica si el estado actual es inactivo (oculto del listado por defecto). */
export function estaInactiva(estado: string | null | undefined): boolean {
  if (!estado) return false;
  return (ESTADOS_INACTIVOS as readonly string[]).includes(estado);
}

/** Solo se puede reactivar desde un estado inactivo. */
export function puedeReactivar(estado: string | null | undefined): boolean {
  return estaInactiva(estado);
}
