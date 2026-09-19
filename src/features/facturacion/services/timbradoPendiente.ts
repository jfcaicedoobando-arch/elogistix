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

/** `true` si el cuerpo devuelto por la edge function es el 202 pendiente. */
export function esRespuestaPendiente(data: unknown): boolean {
  const d = (data ?? {}) as Record<string, unknown>;
  return d.pendiente === true || d.outcome === "timbrado_pendiente";
}

export function respuestaPendiente(data: unknown): TimbradoPendiente {
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    pendiente: true,
    message: typeof d.message === "string" && d.message.trim().length > 0
      ? d.message
      : MSG_TIMBRADO_PENDIENTE_CLIENTE,
  };
}

/** Discrimina la unión resultado-timbrado / pendiente. */
export function esPendiente<T extends object>(
  res: T | TimbradoPendiente,
): res is TimbradoPendiente {
  return (res as TimbradoPendiente).pendiente === true;
}
