import { supabase } from "@/integrations/supabase/client";

import { unwrap } from "@/lib/supabase/response";

/**
 * Consultas usadas exclusivamente para armar el PDF de proforma.
 * Se separan de `queries.ts` para respetar el límite de 200 líneas
 * por archivo productivo (Power of 10 #1).
 */
export async function fetchClienteParaPdf(clienteId: string) {
  return unwrap(
    supabase
      .from("clientes")
      .select("nombre, rfc, direccion, ciudad, estado, cp")
      .eq("id", clienteId)
      .maybeSingle(),
  );
}

export async function fetchEmbarqueParaPdf(embarqueId: string) {
  return unwrap(
    supabase
      .from("embarques")
      .select(
        "expediente, bl_master, bl_house, modo, tipo, incoterm, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, naviera, aerolinea, descripcion_mercancia, contenedores:embarque_contenedores(id, numero_contenedor, tipo_contenedor)",
      )
      .eq("id", embarqueId)
      .single(),
  );
}
