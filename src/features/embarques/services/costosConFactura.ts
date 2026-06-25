/**
 * Devuelve el conjunto de `concepto_costo.id` (del embarque dado) que ya tienen
 * al menos una factura de proveedor vinculada en `proveedor_facturas_conceptos`.
 */
import { supabase } from "@/integrations/supabase/client";

interface Row {
  concepto_costo_id: string | null;
}

export async function fetchCostosConFactura(embarqueId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("proveedor_facturas_conceptos")
    .select("concepto_costo_id, conceptos_costo!inner(embarque_id)")
    .eq("conceptos_costo.embarque_id", embarqueId);
  if (error) throw error;
  // SAFE-CAST: la relación !inner no se refleja en los tipos generados; sólo leemos concepto_costo_id.
  const rows = (data ?? []) as unknown as Row[];
  const set = new Set<string>();
  for (const r of rows) {
    if (r.concepto_costo_id) set.add(r.concepto_costo_id);
  }
  return set;
}
