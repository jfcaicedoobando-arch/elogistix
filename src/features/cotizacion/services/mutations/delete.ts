import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

/** Soft delete vía RPC (A.2.2). El registro queda en papelera y deja de listarse. */
export async function deleteCotizacion(id: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_record", {
    _table: "cotizaciones",
    _id: id,
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "eliminar",
    entidadId: id,
    detalles: { tipo: "soft_delete" },
  });
}
