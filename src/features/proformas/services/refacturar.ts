/**
 * Refacturación por copia controlada: la RPC atómica `refacturar_proforma_rpc`
 * cancela la proforma histórica cuya factura fue cancelada y libera sus
 * conceptos. La nueva proforma se arma de inmediato en el formulario normal
 * del embarque, con esos conceptos y la nota de linaje precargados.
 */
import { supabase } from "@/integrations/supabase/client";

export interface RefacturarResultado {
  embarque_id: string;
  anterior_numero: string;
  factura_cancelada: string;
  conceptos: string[];
  notas_sugeridas: string;
}

/** Estado de navegación que abre «Generar proforma» precargado en el embarque. */
export interface RefacturacionNavState {
  refacturacion: { conceptoIds: string[]; notas: string; anteriorNumero: string };
}

export async function refacturarProforma(proformaId: string): Promise<RefacturarResultado> {
  const { data, error } = await supabase.rpc("refacturar_proforma_rpc", {
    p_proforma_id: proformaId,
  });
  if (error) throw error;
  // SAFE-CAST: la RPC devuelve jsonb con forma fija.
  return data as unknown as RefacturarResultado;
}

export function leerRefacturacionNavState(state: unknown): RefacturacionNavState["refacturacion"] | null {
  if (!state || typeof state !== "object" || !("refacturacion" in state)) return null;
  // SAFE-CAST: sólo `RefacturarProformaAccion` escribe esta forma.
  const r = (state as RefacturacionNavState).refacturacion;
  return r && Array.isArray(r.conceptoIds) && r.conceptoIds.length > 0 ? r : null;
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
