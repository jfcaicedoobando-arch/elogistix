/**
 * Vincula una cotización de prospecto a una oportunidad/lead EXISTENTE del CRM.
 *
 * v13.664.0: una sola llamada transaccional a la RPC `crm_vincular_cotizacion`.
 * P0 (cotizaciones huérfanas): la RPC ya no crea ni deduplica leads. Aquí se
 * exige un `leadId` u `oportunidadId` real y se devuelve el `updated_at` de la
 * cotización para resincronizar el bloqueo optimista del wizard.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface VincularInput {
  cotizacionId: string;
  oportunidadId?: string | null;
  leadId?: string | null;
}

export interface VincularResult {
  oportunidadId: string | null;
  leadId: string | null;
  /** Sello de la cotización tras el vínculo (evita conflictos falsos). */
  updatedAt: string | null;
}

/**
 * Idempotente: si la cotización ya está ligada a esa oportunidad, la RPC no
 * recrea nada. Atómica: oportunidad + `cotizaciones.oportunidad_id` en una
 * transacción.
 */
export async function vincularOCrearOportunidadParaCotizacion(
  input: VincularInput,
): Promise<VincularResult> {
  if (!input.leadId && !input.oportunidadId) {
    throw new Error(
      "Selecciona un prospecto u oportunidad del CRM antes de vincular la cotización.",
    );
  }

  const { data, error } = await supabase.rpc("crm_vincular_cotizacion", {
    p_cotizacion_id: input.cotizacionId,
    p_lead_id: input.leadId || undefined,
    p_oportunidad_id: input.oportunidadId || undefined,
  });
  if (error) throw error;

  const payload = (data ?? {}) as {
    oportunidad_id?: string | null;
    lead_id?: string | null;
    ya_ligada?: boolean;
    updated_at?: string | null;
  };

  if (payload.oportunidad_id && payload.ya_ligada !== true) {
    await registrarActividad({
      modulo: "crm",
      accion: "vincular_cotizacion_oportunidad",
      entidadId: payload.oportunidad_id,
      detalles: { cotizacion_id: input.cotizacionId, lead_id: payload.lead_id ?? null },
    });
  }

  return {
    oportunidadId: payload.oportunidad_id ?? null,
    leadId: payload.lead_id ?? null,
    updatedAt: payload.updated_at ?? null,
  };
}
