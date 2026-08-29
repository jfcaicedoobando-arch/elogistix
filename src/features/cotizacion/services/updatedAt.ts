/**
 * N-2 · Remediación v15 — lectura puntual de `updated_at` de una cotización.
 *
 * Sirve como "sello de tiempo" para el bloqueo optimista: quien va a escribir
 * lee el sello inmediatamente antes y lo manda en el UPDATE; si alguien más
 * guardó en medio, el sello ya no coincide y la escritura se rechaza en vez de
 * pisar el trabajo ajeno.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchCotizacionUpdatedAt(id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("La cotización ya no existe o no tienes acceso.");
  return data.updated_at ?? null;
}
