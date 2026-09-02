/**
 * Rediseño CRM (v13.766.0) — gate de calificación Lead → Prospecto.
 *
 * La validación real vive en la RPC `crm_calificar_prospecto`
 * (SECURITY DEFINER, candado multi-tenant + rol de ventas + perfil ICP
 * completo). Aquí sólo traducimos los códigos de error a español.
 */
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { ETIQUETAS_GATE_PROSPECTO, CAMPOS_GATE_PROSPECTO } from "@/features/crm/domain/leads/etapas";

export interface CalificarProspectoResultado {
  lead_id: string;
  estado: string;
  calificado: boolean;
}

type CampoGate = (typeof CAMPOS_GATE_PROSPECTO)[number];

function etiquetarFaltantes(raw: string): string {
  const lista = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((campo) => ETIQUETAS_GATE_PROSPECTO[campo as CampoGate] ?? campo);
  return lista.join(", ");
}

/** Traduce los códigos `LC_*` de la RPC a mensajes para el usuario. */
export function mensajeErrorCalificar(error: unknown): string {
  const msg = getErrorMessage(error);
  if (msg.includes("LC_LEAD_PERFIL_INCOMPLETO")) {
    const detalle = msg.split("LC_LEAD_PERFIL_INCOMPLETO:")[1] ?? "";
    const campos = etiquetarFaltantes(detalle);
    return campos
      ? `Falta completar el perfil comercial: ${campos}.`
      : "Falta completar el perfil comercial del lead.";
  }
  if (msg.includes("LC_LEAD_SIN_ASIGNAR")) {
    return "Este lead todavía no tiene vendedor asignado. Tómalo o pide que te lo asignen antes de calificarlo.";
  }
  if (msg.includes("LC_LEAD_SIN_PERMISO_CALIFICAR")) {
    return "No puedes calificar este lead: sólo su vendedor asignado o gerencia comercial de tu organización pueden hacerlo.";
  }
  if (msg.includes("LC_LEAD_ESTADO_NO_CALIFICABLE")) {
    return "Este lead ya fue descalificado o convertido en cliente.";
  }
  if (msg.includes("LC_ORG_AJENA")) {
    return "El lead pertenece a otra organización.";
  }
  if (msg.includes("LC_LEAD_NO_ENCONTRADO")) {
    return "El lead ya no existe.";
  }
  return msg;
}

export async function calificarProspecto(
  leadId: string,
): Promise<CalificarProspectoResultado> {
  const { data, error } = await supabase.rpc("crm_calificar_prospecto", {
    p_lead_id: leadId,
  });
  if (error) throw error;
  // SAFE-CAST: jsonb devuelto por la RPC crm_calificar_prospecto.
  return data as unknown as CalificarProspectoResultado;
}
