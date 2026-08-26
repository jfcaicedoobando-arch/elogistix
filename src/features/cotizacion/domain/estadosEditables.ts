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

/**
 * B-11/B-12 (v13.749.0) — Motivo por el que NO se puede editar una cotización,
 * o `null` si sí es editable. Sustituye el rebote mudo al detalle: la pantalla
 * ahora explica el candado.
 *
 * Reglas:
 * - Sólo `Borrador` y `Solicitada` son editables (candado histórico).
 * - Una cotización ya vinculada a un embarque (`embarque_id`) queda inmutable
 *   aunque siga en Borrador: editarla desincroniza la venta contra los costos
 *   reales del expediente.
 */
export function motivoBloqueoEdicionCotizacion(cotizacion: {
  estado?: string | null;
  embarque_id?: string | null;
}): string | null {
  if (cotizacion.embarque_id) {
    return "Esta cotización ya está vinculada a un embarque en operación. Editarla desincronizaría la venta contra los costos reales del expediente.";
  }
  if (!esEstadoEditableEnWizard(cotizacion.estado)) {
    return `Una cotización en estado "${cotizacion.estado ?? "desconocido"}" ya no se puede editar. Sólo Borrador y Solicitada son editables.`;
  }
  return null;
}
