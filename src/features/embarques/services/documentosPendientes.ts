/**
 * Conteo de documentos operativos aún en estado "Pendiente" para un embarque.
 * Extraído de `TrackingNuevoEventoForm.tsx` (Block 1.6 de la refactor
 * arquitectónica) para eliminar el import directo a `@/integrations/supabase/client`.
 */
import { supabase } from "@/integrations/supabase/client";

export async function contarDocumentosPendientes(embarqueId: string): Promise<number> {
  const { count, error } = await supabase
    .from("documentos_embarque")
    .select("id", { count: "exact", head: true })
    .eq("embarque_id", embarqueId)
    .eq("estado", "Pendiente")
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}
