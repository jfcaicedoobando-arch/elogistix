/** Autorización interna de cotizaciones: sólo por RPC (la base decide). */
import { supabase } from "@/integrations/supabase/client";

export async function solicitarAutorizacionCotizacion(id: string): Promise<void> {
  const { error } = await supabase.rpc("solicitar_autorizacion_cotizacion", { p_id: id });
  if (error) throw error;
}

export async function autorizarCotizacion(id: string, motivo: string | null): Promise<void> {
  const { error } = await supabase.rpc("autorizar_cotizacion", { p_id: id, p_motivo: motivo ?? undefined });
  if (error) throw error;
}
