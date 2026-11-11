/**
 * Saneo del patch que un evento de FacturAPI aplica a `facturas`.
 * Extraído de `index.ts` (Power of 10: complejidad y líneas por archivo); el
 * comportamiento es idéntico al previo.
 */
interface FacturaLocalMin {
  id: string;
  estado?: string | null;
  sustituida_por?: string | null;
  cancellation_status?: string | null;
  uuid_fiscal?: string | null;
}

/** Estados en los que un evento `valid` tardío sí puede fijar "Emitida". */
const ESTADOS_HASTA_EMISION = new Set(["Borrador", "Por timbrar", "Emitida"]);

export function sanearPatchFactura(
  mapped: { patch: Record<string, unknown>; preserva_sustituida?: boolean },
  factura: FacturaLocalMin,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { ...mapped.patch };
  // Una factura ya timbrada puede tener el valor efectivo leído del XML.
  // Un evento tardío no debe reemplazarlo por el dato solicitado del proveedor.
  if (factura.uuid_fiscal) delete patch.uso_cfdi;

  // Si el evento cancela pero la factura fue sustitución, NO sobrescribimos
  // `estado` — el cron de reconciliación lo fija a "Sustituida" al descargar
  // el acuse. Sí conservamos el resto del patch.
  if (mapped.preserva_sustituida && (factura.estado === "Sustituida" || factura.sustituida_por)) {
    delete patch.estado;
  }

  // Ola 4 · N3: un evento `valid` tardío (re-notificación de FacturAPI) no
  // debe regresar a "Emitida" una factura que ya avanzó en su ciclo de vida.
  if (patch.estado === "Emitida" && !ESTADOS_HASTA_EMISION.has(factura.estado ?? "")) {
    delete patch.estado;
  }

  // EF-06: un cancellation_status_updated(pending/verifying) retrasado no debe
  // regresar una cancelación ya aceptada (retries/reordenamiento de FacturAPI).
  if (
    factura.cancellation_status === "accepted" &&
    typeof patch.cancellation_status === "string" &&
    patch.cancellation_status !== "accepted"
  ) {
    delete patch.cancellation_status;
    delete patch.cancelacion_solicitada_en;
    delete patch.cancelacion_vence_en;
  }

  return patch;
}
