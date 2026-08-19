/**
 * Superficie pública de los servicios de notificaciones internas.
 *
 * Ola 20 · paso 4: sólo re-exporta.
 */
export type { NotificacionInterna } from "./notificacionesInternas";
export {
  fetchNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  subscribeNotificaciones,
} from "./notificacionesInternas";
