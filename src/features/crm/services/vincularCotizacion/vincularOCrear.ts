/**
 * Vincula una cotización a una oportunidad/lead existente o crea ambos.
 *
 * v13.664.0: una sola llamada transaccional a la RPC `crm_vincular_cotizacion`
 * (antes eran 3-4 llamadas sueltas "mejor esfuerzo" que dejaban cotizaciones
 * huérfanas si alguna fallaba a la mitad).
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { AuthLite, ProspectoData } from "./helpers";

export interface VincularInput {
  cotizacionId: string;
  cotizacionFolio?: string;
  modoTransporte: string;
  oportunidadId?: string | null;
  leadId?: string | null;
  prospecto: ProspectoData;
  user: AuthLite | null;
}

export interface VincularResult {
  oportunidadId: string | null;
  leadId: string | null;
}

/**
 * Idempotente: si la cotización ya tiene `oportunidad_id` la RPC no recrea nada.
 * Atómica: lead + oportunidad + `cotizaciones.oportunidad_id` en una transacción.
 */
export async function vincularOCrearOportunidadParaCotizacion(
  input: VincularInput,
): Promise<VincularResult> {
  const { data, error } = await supabase.rpc("crm_vincular_cotizacion", {
    p_cotizacion_id: input.cotizacionId,
    p_prospecto: {
      empresa: input.prospecto.empresa,
      contacto: input.prospecto.contacto,
      email: input.prospecto.email,
      telefono: input.prospecto.telefono,
      rfc: input.prospecto.rfc ?? "",
      direccion: input.prospecto.direccion ?? "",
      ciudad: input.prospecto.ciudad ?? "",
      entidad_federativa: input.prospecto.entidadFederativa ?? "",
      cp: input.prospecto.cp ?? "",
    },
    p_lead_id: input.leadId || undefined,
    p_oportunidad_id: input.oportunidadId || undefined,
  });
  if (error) throw error;

  const payload = (data ?? {}) as {
    oportunidad_id?: string | null;
    lead_id?: string | null;
    ya_ligada?: boolean;
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
  };
}
