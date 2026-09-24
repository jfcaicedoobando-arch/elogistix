import { supabase } from "@/integrations/supabase/client";

export interface AgenteResuelto { id: string; nombre: string }

/**
 * LCL: el consolidador de la cotización es un PROVEEDOR; la ruta del embarque
 * usa un AGENTE (`costeo_agentes`). Sólo se transfiere cuando existe
 * exactamente un agente activo cuyo `proveedor_id` es ese consolidador
 * (relación verificada). Con 0 o varios, no se adivina: devuelve null.
 */
export async function resolverAgenteDeConsolidador(
  proveedorId: string,
): Promise<AgenteResuelto | null> {
  const { data, error } = await supabase
    .from("costeo_agentes")
    .select("id, nombre")
    .eq("proveedor_id", proveedorId)
    .eq("activo", true)
    .limit(2);
  if (error || !data || data.length !== 1) return null;
  return { id: data[0].id, nombre: data[0].nombre };
}
