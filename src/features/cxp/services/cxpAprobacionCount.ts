import { supabase } from "@/integrations/supabase/client";

/**
 * Cuenta de facturas pendientes de aprobación en la org del usuario actual.
 * Usado por el badge del sidebar del módulo Compras.
 */
export async function fetchPendientesAprobacionCount(): Promise<number> {
  const { data, error } = await supabase.rpc("cxp_pendientes_aprobacion_count");
  if (error) throw error;
  return Number(data ?? 0);
}
