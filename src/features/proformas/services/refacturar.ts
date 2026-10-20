/**
 * Refacturación por copia controlada: cancela la proforma histórica cuya
 * factura fue cancelada y crea una nueva proforma en borrador con los mismos
 * conceptos (RPC atómica `refacturar_proforma_rpc`).
 */
import { supabase } from "@/integrations/supabase/client";

export interface RefacturarResultado {
  nueva_proforma_id: string;
  nuevo_numero: string;
  anterior_numero: string;
  factura_cancelada: string;
}

export async function refacturarProforma(proformaId: string): Promise<RefacturarResultado> {
  const { data, error } = await supabase.rpc("refacturar_proforma_rpc", {
    p_proforma_id: proformaId,
  });
  if (error) throw error;
  // SAFE-CAST: la RPC devuelve jsonb con forma fija.
  return data as unknown as RefacturarResultado;
}

/** Número de la factura cancelada ligada a la proforma, o null. */
export async function facturaCanceladaDeProforma(proformaId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("facturas")
    .select("numero")
    .eq("proforma_id", proformaId)
    .eq("estado", "Cancelada")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.numero ?? null;
}
