/**
 * I/O puro del paso 1 del wizard de cotización: registra en bitácora el
 * bloqueo tarifa-first.
 *
 * P0 (cotizaciones huérfanas): el vínculo CRM ya no necesita usuario ni folio
 * (la RPC `crm_vincular_cotizacion` los resuelve en la base), por lo que
 * `obtenerUsuarioActual` y `fetchCotizacionFolio` se retiraron de aquí.
 */
import { registrarActividad } from "@/services/bitacora/registrar";

export interface BloqueoSinTarifaPayload {
  entidadNombre: string;
  origen: string | null;
  destino: string | null;
  tipoContenedor: string | null;
}

/**
 * Registra en bitácora cuando el bloqueo tarifa-first detiene el avance.
 * Best-effort: si falla, no rompe el flujo de validación.
 */
export async function registrarBloqueoSinTarifa(payload: BloqueoSinTarifaPayload): Promise<void> {
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "cotizacion_bloqueada_sin_tarifa",
    entidadNombre: payload.entidadNombre,
    detalles: {
      origen: payload.origen,
      destino: payload.destino,
      tipo_contenedor: payload.tipoContenedor,
    },
  });
}
