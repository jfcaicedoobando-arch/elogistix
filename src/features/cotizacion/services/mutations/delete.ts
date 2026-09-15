import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

const ERROR_NO_CONFIRMADO =
  "No se pudo eliminar la cotización: no tienes permiso o la cotización ya no existe.";

/**
 * Soft delete vía RPC (A.2.2). El registro queda en papelera y deja de listarse.
 *
 * COT-DEL-01: `soft_delete_record` devuelve void, así que un id inexistente o
 * filtrado por RLS podía verse como éxito y escribir bitácora de un borrado que
 * nunca ocurrió. Igual que `updateEstadoCotizacion`, la actividad sólo se
 * registra después de confirmar el efecto: la fila existía viva antes y quedó
 * marcada como borrada después. Sigue siendo soft delete (nunca DELETE físico).
 */
export async function deleteCotizacion(id: string): Promise<void> {
  const previo = await supabase
    .from("cotizaciones")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (previo.error) throw previo.error;
  if (!previo.data) throw new Error(ERROR_NO_CONFIRMADO);

  const { error } = await supabase.rpc("soft_delete_record", {
    _table: "cotizaciones",
    _id: id,
  });
  if (error) throw error;

  const posterior = await supabase
    .from("cotizaciones")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (posterior.error) throw posterior.error;
  if (posterior.data) throw new Error(ERROR_NO_CONFIRMADO);

  await registrarActividad({
    modulo: "cotizaciones",
    accion: "eliminar",
    entidadId: id,
    detalles: { tipo: "soft_delete" },
  });
}
