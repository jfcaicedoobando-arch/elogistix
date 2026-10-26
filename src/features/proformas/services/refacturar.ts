/**
 * Refacturación por copia controlada: cancela la proforma histórica cuya
 * factura fue cancelada y libera conceptos para el formulario normal.
 * Contrato recuperado de ec96cf2; no crea la nueva proforma todavía.
 */
import { supabase } from "@/integrations/supabase/client";

import { leerResultadoRefacturacion, type RefacturarResultado } from "../domain/refacturacion";

export async function refacturarProforma(proformaId: string): Promise<RefacturarResultado> {
  const { data, error } = await supabase.rpc("refacturar_proforma_rpc", {
    p_proforma_id: proformaId,
  });
  if (error) throw error;
  return leerResultadoRefacturacion(data);
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
