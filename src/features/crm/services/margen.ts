/**
 * Autorización del margen esperado de una oportunidad (mapeo CRM Hunter).
 * La RPC `crm_autorizar_margen` valida SoD en base de datos: sólo
 * super_admin, admin_org o gerente_comercial de la misma organización.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export async function autorizarMargenOportunidad(input: {
  oportunidadId: string;
  margenPct: number;
}): Promise<void> {
  const { error } = await supabase.rpc("crm_autorizar_margen", {
    _oportunidad_id: input.oportunidadId,
    _margen_pct: input.margenPct,
  });
  if (error) throw new Error(error.message);
  await registrarActividad({
    modulo: "crm",
    accion: "autorizar_margen_oportunidad",
    entidadId: input.oportunidadId,
    detalles: { margen_pct: input.margenPct },
  });
}
