/**
 * Baja lógica de una empresa del CRM. Una empresa que ya es cliente nunca se
 * elimina; la base lo vuelve a validar con `_crm_empresa_no_borrar_cliente`.
 */
import { supabase } from "@/integrations/supabase/client";
import { estadoEmpresa } from "./estadoEmpresaCrm";

export const MSG_EMPRESA_ES_CLIENTE = "Esta empresa ya es cliente y no se puede eliminar.";

export function puedeEliminarEmpresa(fila: { estado_crm?: string | null; cliente_id: string | null }): boolean {
  return !fila.cliente_id && estadoEmpresa(fila) !== "Cliente";
}

export async function eliminarEmpresa(empresaId: string): Promise<void> {
  const { data, error } = await supabase.from("crm_empresas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", empresaId).is("deleted_at", null).select("id");
  if (error) {
    if (error.message.includes("LC_CRM_EMPRESA_ES_CLIENTE")) throw new Error(MSG_EMPRESA_ES_CLIENTE);
    throw error;
  }
  if (!data?.length) throw new Error("La empresa ya no existe o no tienes permiso para eliminarla.");
}
