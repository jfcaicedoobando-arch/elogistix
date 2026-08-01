/**
 * Estados de cotización que permiten abrir el wizard de edición/costeo.
 *
 * P0-1 (R5, v13.389.0): las cotizaciones solicitadas desde el portal del cliente
 * nacen en `Solicitada` y el ejecutivo de pricing debe poder completarlas
 * (capturar costos y conceptos) desde el wizard. El guard SQL
 * `guard_estado_cotizacion` ya permite Solicitada → Borrador / Enviada.
 */
export const ESTADOS_EDITABLES_WIZARD = ["Borrador", "Solicitada"] as const;

export type EstadoEditableWizard = (typeof ESTADOS_EDITABLES_WIZARD)[number];

export function esEstadoEditableEnWizard(estado: string | null | undefined): boolean {
  return ESTADOS_EDITABLES_WIZARD.includes(estado as EstadoEditableWizard);
}

/** `true` si al guardar el wizard hay que mover la cotización a `Borrador`. */
export function requiereTransicionABorrador(estado: string | null | undefined): boolean {
  return estado === "Solicitada";
}
