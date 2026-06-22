/**
 * Aprobación / rechazo de facturas de proveedor.
 * Wrapper de la RPC `aprobar_factura_proveedor` (SECURITY DEFINER con check de rol).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type EstadoAprobacion = "pendiente" | "aprobada" | "rechazada";

export async function aprobarFacturaProveedor(
  id: string,
  aprobar: boolean,
  motivo?: string,
): Promise<Tables<"proveedor_facturas">> {
  const { data, error } = await supabase.rpc("aprobar_factura_proveedor", {
    p_id: id,
    p_aprobar: aprobar,
    p_motivo: motivo,
  });
  if (error) throw error;
  // SAFE-CAST: la RPC retorna el row completo de proveedor_facturas; Supabase tipa el `data` como genérico.
  return data as unknown as Tables<"proveedor_facturas">;
}
