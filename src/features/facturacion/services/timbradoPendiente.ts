/**
 * Respuesta 202 "timbrado pendiente" de las edge functions de facturación.
 *
 * `facturapi-emitir` y `facturapi-emitir-rep` responden 202 con
 * `{ outcome: "timbrado_pendiente", pendiente: true, message }` cuando FacturAPI
 * recibió el documento pero el SAT aún no devolvió el timbre: NO hay UUID ni
 * folio y el documento sigue "Por timbrar". El cliente debe avisarlo como
 * proceso en curso y NO como éxito ni invitar a reintentar (reintentar duplica
 * el CFDI).
 */

export const MSG_TIMBRADO_PENDIENTE_CLIENTE =
  "El proveedor recibió el documento y está recuperando el timbre del SAT. No vuelvas a timbrar: el sistema lo marcará como emitido en cuanto el SAT responda.";

export interface TimbradoPendiente {
  pendiente: true;
  message: string;
}

/**
 * Type guard real sobre el contrato wire: estrecha a `TimbradoPendienteWire`
 * en vez de devolver un `boolean` suelto.
 */
export const esRespuestaPendiente = esPendienteWire;

/** Normaliza el 202 validado (ya no recibe `unknown`). */
export function respuestaPendiente(data: TimbradoPendienteWire): TimbradoPendiente {
  return {
    pendiente: true,
    message: typeof data.message === "string" && data.message.trim().length > 0
      ? data.message
      : MSG_TIMBRADO_PENDIENTE_CLIENTE,
  };
}

/** Discrimina la unión resultado-timbrado / pendiente. */
export function esPendiente<T extends object>(
  res: T | TimbradoPendiente | null | undefined,
): res is TimbradoPendiente {
  return (res as TimbradoPendiente | null | undefined)?.pendiente === true;
}
