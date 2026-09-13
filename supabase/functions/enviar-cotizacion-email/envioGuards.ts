import { jsonResponse } from '../_shared/response.ts';
import type { Cotizacion } from './sendHelpers.ts';

/**
 * v13.823.355 (YAGNI r2 · P1) — candados de ciclo de vida del correo.
 *
 * La UI ocultaba el botón, pero la función podía invocarse directamente:
 * 1) una cotización de prospecto SIN oportunidad ligada no se envía
 *    (`LC_COT_SIN_OPORTUNIDAD`, el mismo código que emite la base);
 * 2) los estados terminales no vigentes (Rechazada/Vencida/Archivada) no se
 *    envían ni se reenvían. Enviada/Aceptada sí (reenvío legítimo).
 */
export const ESTADOS_NO_ENVIABLES = ['Rechazada', 'Vencida', 'Archivada'];

export function validarCotizacionEnviable(
  cot: Cotizacion,
  cors: Record<string, string>,
): Response | null {
  if (cot.es_prospecto && !cot.oportunidad_id) {
    return jsonResponse({
      error: 'Liga la cotización a una oportunidad del CRM antes de enviarla al prospecto',
      code: 'LC_COT_SIN_OPORTUNIDAD',
    }, 400, cors);
  }
  if (ESTADOS_NO_ENVIABLES.includes(String(cot.estado))) {
    return jsonResponse({
      error: `La cotización está ${cot.estado} y ya no puede enviarse; re-cotiza o duplícala para enviar una versión vigente`,
      code: 'LC_COT_ESTADO_NO_ENVIABLE',
    }, 400, cors);
  }
  return null;
}
