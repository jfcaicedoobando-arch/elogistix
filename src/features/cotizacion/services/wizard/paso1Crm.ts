/**
 * I/O puro del paso 1 del wizard de cotización: obtiene el usuario auth
 * actual, el folio de una cotización recién creada y registra el bloqueo
 * tarifa-first en bitácora. Encapsula las llamadas a Supabase para que el
 * helper `handlePaso1Crm` no las haga directamente.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface AuthUserLite {
  id: string;
  email: string | undefined;
}

export async function obtenerUsuarioActual(): Promise<AuthUserLite | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? undefined } : null;
}

export async function fetchCotizacionFolio(cotizacionId: string): Promise<string | null> {
  // YG-07: mismo criterio que `services/queries.ts` — soft-deleted = inexistente.
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("folio")
    .eq("id", cotizacionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data?.folio ?? null;
}


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

