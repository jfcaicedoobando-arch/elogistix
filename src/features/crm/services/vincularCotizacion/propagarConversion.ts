/**
 * Propaga la conversión de prospecto → cliente al pipeline CRM.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

/**
 * Llamado tras `convertirProspectoACliente`. Propaga el cliente al CRM:
 * - Setea cliente_id/cliente_nombre en la oportunidad.
 * - Marca el lead asociado como Convertido.
 */
export async function propagarConversionProspectoCRM(input: {
  oportunidadId: string | null;
  clienteId: string;
  clienteNombre: string;
}): Promise<void> {
  if (!input.oportunidadId) return;

  const { data: op, error: errOp } = await supabase
    .from("crm_oportunidades")
    .select("lead_id")
    .eq("id", input.oportunidadId)
    .maybeSingle();
  if (errOp) throw errOp;

  const { error: errUpdOp } = await supabase
    .from("crm_oportunidades")
    .update({ cliente_id: input.clienteId, cliente_nombre: input.clienteNombre })
    .eq("id", input.oportunidadId);
  if (errUpdOp) throw errUpdOp;

  if (op?.lead_id) {
    const { error: errLead } = await supabase
      .from("crm_leads")
      .update({
        estado: "Convertido",
        cliente_convertido_id: input.clienteId,
        oportunidad_convertida_id: input.oportunidadId,
      })
      .eq("id", op.lead_id);
    if (errLead) throw errLead;
  }

  await registrarActividad({
    modulo: "crm",
    accion: "propagar_conversion_prospecto",
    entidadId: input.oportunidadId,
    entidadNombre: input.clienteNombre,
    detalles: { cliente_id: input.clienteId },
  });
}
