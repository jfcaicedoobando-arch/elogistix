/**
 * Consulta puntual del borrador sustituto (estado + uuid_fiscal) usada por
 * el wizard de sustitución CFDI. Extraído de `useSustitucionState.ts`
 * (Block 1.6) para que el hook no importe el cliente Supabase directamente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SustitutaEstado {
  id: string;
  estado: string | null;
  uuid_fiscal: string | null;
}

export async function fetchSustitutaEstado(
  facturaId: string,
): Promise<SustitutaEstado | null> {
  const { data, error } = await supabase
    .from("facturas")
    .select("id, estado, uuid_fiscal")
    .eq("id", facturaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
