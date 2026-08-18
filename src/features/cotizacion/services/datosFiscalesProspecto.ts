/**
 * Lee los datos fiscales que el vendedor capturó una sola vez en el lead del CRM,
 * para precargar el alta de cliente al convertir un prospecto (captura única).
 */
import { supabase } from "@/integrations/supabase/client";

export interface DatosFiscalesProspecto {
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
}

const VACIO: DatosFiscalesProspecto = { rfc: "", direccion: "", ciudad: "", estado: "", cp: "" };

/** Falla suave: si no hay lead o la lectura falla, devuelve campos vacíos. */
export async function fetchDatosFiscalesProspecto(
  oportunidadId: string | null,
): Promise<DatosFiscalesProspecto> {
  if (!oportunidadId) return VACIO;

  const { data: op, error: errOp } = await supabase
    .from("crm_oportunidades")
    .select("lead_id")
    .eq("id", oportunidadId)
    .maybeSingle();
  if (errOp || !op?.lead_id) return VACIO;

  const { data: lead, error } = await supabase
    .from("crm_leads")
    .select("rfc, direccion, ciudad, entidad_federativa, cp")
    .eq("id", op.lead_id)
    .maybeSingle();
  if (error || !lead) return VACIO;

  return {
    rfc: lead.rfc ?? "",
    direccion: lead.direccion ?? "",
    ciudad: lead.ciudad ?? "",
    estado: lead.entidad_federativa ?? "",
    cp: lead.cp ?? "",
  };
}
