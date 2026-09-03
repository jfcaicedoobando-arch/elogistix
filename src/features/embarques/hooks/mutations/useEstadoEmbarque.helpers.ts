/**
 * Helpers de useEstadoEmbarque: requestId estable por transición (con TTL) y
 * clasificación de rechazos esperados del auto-sync.
 *
 * FIX-R3 (M-3 / review_ola1 B2): el Map era eterno — tras reabrir un embarque,
 * la misma transición reusaba la llave y la RPC devolvía la respuesta cacheada
 * SIN ejecutarse (desync silencioso UI↔BD). Ahora cada entrada tiene TTL y,
 * cuando la RPC responde `replay: true`, la llave se invalida y se reintenta
 * con requestId fresco para que el avance ocurra de verdad.
 */
import { newRequestId } from '@/lib/idempotency';

const TTL_REQUEST_ID_AUTOSYNC_MS = 30 * 60 * 1000; // 30 min
const requestIdsAutoSync = new Map<string, { requestId: string; creadoEn: number }>();

export function requestIdTransicion(embarqueId: string, nuevoEstado: string): string {
  const clave = `${embarqueId}:${nuevoEstado}`;
  const existente = requestIdsAutoSync.get(clave);
  if (existente && Date.now() - existente.creadoEn < TTL_REQUEST_ID_AUTOSYNC_MS) {
    return existente.requestId;
  }
  const nuevo = newRequestId();
  requestIdsAutoSync.set(clave, { requestId: nuevo, creadoEn: Date.now() });
  return nuevo;
}

export function invalidarRequestIdTransicion(embarqueId: string, nuevoEstado: string): void {
  requestIdsAutoSync.delete(`${embarqueId}:${nuevoEstado}`);
}

/**
 * Rechazos esperados del auto-sync: el estado sugerido por fechas no procede
 * todavía (faltan documentos, falta la llegada real, la transición no aplica o
 * alguien más movió el embarque). No son errores del usuario: se ignoran en
 * silencio y el cambio manual sigue mostrando el motivo.
 */
const RECHAZOS_ESPERADOS_AUTOSYNC = [
  'documentos_faltantes',
  'fecha_llegada_real_requerida',
  'LC_TRANSICION_INVALIDA',
  'LC_ESTADO_CONCURRENTE',
];

export function esRechazoEsperado(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error ?? '');
  return RECHAZOS_ESPERADOS_AUTOSYNC.some((codigo) => mensaje.includes(codigo));
}
