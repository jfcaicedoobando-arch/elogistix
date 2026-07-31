/**
 * Helpers puros de estado temporal de un embarque (arribo real y vencimiento de
 * ETA). Extraídos de `embarqueFases.ts` en v13.380.2 para respetar el límite de
 * 200 líneas por archivo.
 */
import type { EmbarqueEstadoTemporalInput } from "./embarqueFasesTipos";

/**
 * Un embarque se considera arribado si tiene fecha de llegada real o si su
 * estado ya es posterior al arribo físico.
 */
export function esEmbarqueArribado(
  embarque?: EmbarqueEstadoTemporalInput | null,
): boolean {
  if (!embarque) return false;
  if (embarque.fecha_llegada_real != null) return true;
  return embarque.estado === "Entregado"
    || embarque.estado === "EIR"
    || embarque.estado === "Por liquidar"
    || embarque.estado === "Cerrado";
}

/**
 * ETA vencida: la fecha estimada de arribo ya pasó (fin del día en hora local
 * de México) y el embarque no ha arribado.
 *
 * `new Date("YYYY-MM-DD")` se parsea como UTC, por lo que una ETA capturada
 * "hoy" quedaba como ayer 18:00 CDMX. Aquí se parsea componente por componente.
 */
export function esEtaVencida(
  embarque?: EmbarqueEstadoTemporalInput | null,
): boolean {
  if (!embarque?.eta) return false;
  if (esEmbarqueArribado(embarque)) return false;
  const [y, m, d] = embarque.eta.split("-").map(Number);
  if (!y || !m || !d) return false;
  const finDelDiaEtaLocal = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  return finDelDiaEtaLocal < Date.now();
}
