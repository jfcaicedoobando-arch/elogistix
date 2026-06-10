import { supabase } from "@/integrations/supabase/client";
import type { EstadoGarantia, GarantiaContenedor } from "../types/garantia";

export async function fetchGarantiasEmbarque(embarqueId: string): Promise<GarantiaContenedor[]> {
  const { data, error } = await supabase
    .from("embarque_garantias_contenedor")
    .select("id, embarque_id, embarque_contenedor_id, naviera_id, monto_deposito_usd, tiene_carta_garantia, estado, fecha_deposito, fecha_liberacion, notas")
    .eq("embarque_id", embarqueId);
  if (error) throw error;
  return (data ?? []) as GarantiaContenedor[];
}

export interface UpdateGarantiaInput {
  id: string;
  estado: EstadoGarantia;
  fecha_deposito?: string | null;
  fecha_liberacion?: string | null;
  monto_deposito_usd?: number;
  notas?: string | null;
}

export async function updateGarantia(input: UpdateGarantiaInput): Promise<void> {
  const { id, ...rest } = input;
  const { error } = await supabase
    .from("embarque_garantias_contenedor")
    .update(rest)
    .eq("id", id);
  if (error) throw error;
}
