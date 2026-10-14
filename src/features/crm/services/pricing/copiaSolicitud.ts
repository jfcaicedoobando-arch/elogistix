/**
 * Datos para una nueva solicitud copiada de otra (de cualquier estado).
 * No copia folio, estado, reloj, autoría ni la tarifa elegida: la base los asigna.
 */
import type { SolicitudPricingInsert, SolicitudPricingRow } from "./tiposPricing";

export function datosCopiaSolicitud(s: SolicitudPricingRow): SolicitudPricingInsert {
  const {
    id: _id, folio: _folio, estado: _estado, created_at: _c, updated_at: _u, created_by: _cb,
    deleted_at: _d, enviada_at: _e, vence_at: _v, respondida_at: _r, tarifa_tarifario_id: _t,
    fecha: _f, ...datos
  } = s;
  return datos;
}
