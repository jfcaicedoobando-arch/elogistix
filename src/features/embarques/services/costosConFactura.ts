/**
 * Devuelve el conjunto de `concepto_costo.id` (del embarque dado) que ya tienen
 * al menos una factura de proveedor vinculada en `proveedor_facturas_conceptos`.
 *
 * Se usa el patrón de dos pasos (sin embed `!inner`) porque la FK física entre
 * `proveedor_facturas_conceptos.concepto_costo_id` y `conceptos_costo.id` no
 * está registrada en el schema cache de PostgREST (PGRST200). Mismo patrón que
 * `reconciliacionCostos.ts`.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchCostosConFactura(embarqueId: string): Promise<Set<string>> {
  if (!embarqueId) return new Set<string>();

  const { data: cc, error: errCc } = await supabase
    .from("conceptos_costo")
    .select("id")
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null);
  if (errCc) throw errCc;

  const ids = (cc ?? []).map((r) => r.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return new Set<string>();

  const { data: pfc, error: errPfc } = await supabase
    .from("proveedor_facturas_conceptos")
    .select("concepto_costo_id")
    .in("concepto_costo_id", ids);
  if (errPfc) throw errPfc;

  const set = new Set<string>();
  for (const r of pfc ?? []) {
    if (r.concepto_costo_id) set.add(r.concepto_costo_id);
  }
  return set;
}
