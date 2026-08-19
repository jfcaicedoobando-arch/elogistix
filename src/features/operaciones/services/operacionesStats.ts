/**
 * Ejecuta el RPC `operaciones_stats`, que agrega en el servidor todas las
 * métricas por operador/global usadas por el dashboard de operaciones.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import type { ServerStats } from "./operacionesTypes";

export async function fetchOperacionesStats(): Promise<ServerStats> {
  const { data, error } = await supabase.rpc("operaciones_stats");
  if (error) throw error;
  return fromDb<ServerStats>(data);
}
