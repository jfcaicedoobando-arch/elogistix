/**
 * Servicio: consulta documentos faltantes para avance de estado.
 * Aísla el acceso a Supabase para que los hooks no importen el cliente.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchDocsFaltantesParaEstado(
  embarqueId: string,
  estadoDestino: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("embarque_docs_faltantes", {
    p_embarque_id: embarqueId,
    p_estado_destino: estadoDestino,
  });
  if (error) throw error;
  return (data as string[] | null) ?? [];
}
