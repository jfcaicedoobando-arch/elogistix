/**
 * Conteo de movimientos bancarios pendientes de conciliar (toda la
 * organización; RLS acota por tenant). Alimenta el aviso del dashboard de
 * Tesorería sin traer los renglones.
 */
import { supabase } from "@/integrations/supabase/client";

export async function contarMovimientosPendientes(): Promise<number> {
  const { count, error } = await supabase
    .from("bbva_movimientos")
    .select("id", { count: "exact", head: true })
    .eq("estado_conciliacion", "Pendiente")
    // Ola 5 · A6/B9: los movimientos manuales borrados (soft delete) no cuentan.
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}
