/**
 * Servicio puente para el RPC `asignar_conceptos_a_proforma`.
 * Aísla la llamada que antes vivía en `ProformaInconsistenteAlert.tsx`.
 */
import { supabase } from "@/integrations/supabase/client";

export async function asignarConceptosAProforma(
  proformaId: string,
  conceptoIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc("asignar_conceptos_a_proforma", {
    p_proforma_id: proformaId,
    p_concepto_ids: conceptoIds,
  });
  if (error) throw error;
}
