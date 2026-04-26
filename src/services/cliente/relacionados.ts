import { supabase } from "@/integrations/supabase/client";

export async function fetchEmbarquesCliente(clienteId: string) {
  const { data, error } = await supabase
    .from("embarques")
    .select(
      "id, expediente, modo, tipo, estado, etd, eta, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, cliente_nombre",
    )
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCotizacionesCliente(clienteId: string) {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(
      "id, folio, modo, tipo, origen, destino, estado, subtotal, moneda, created_at",
    )
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
