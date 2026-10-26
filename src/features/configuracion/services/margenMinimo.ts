import { supabase } from "@/integrations/supabase/client";

/** Conserva la validación y autorización canónica del RPC. */
export async function guardarMargenMinimo(pct: number): Promise<void> {
  const { error } = await supabase.rpc("set_margen_minimo_utilidad", { p_pct: pct });
  if (error) throw error;
}
