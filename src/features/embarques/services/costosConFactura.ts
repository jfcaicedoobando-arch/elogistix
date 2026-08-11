/**
 * Devuelve el conjunto de `concepto_costo.id` (del embarque dado) que ya tienen
 * al menos una factura de proveedor VIVA vinculada en
 * `proveedor_facturas_conceptos` (se ignoran las borradas y las Canceladas).
 *
 * Se usa el patrón de dos pasos (sin embed `!inner`) porque la FK física entre
 * `proveedor_facturas_conceptos.concepto_costo_id` y `conceptos_costo.id` no
 * está registrada en el schema cache de PostgREST (PGRST200). Mismo patrón que
 * `reconciliacionCostos.ts`.
 */
import { supabase } from "@/integrations/supabase/client";

type PFCEstadoRow = {
  concepto_costo_id: string | null;
  proveedor_facturas: { estado: string | null; deleted_at: string | null } | null;
};

/** v13.505.0 — una factura cancelada o borrada no "cubre" el concepto. */
export function esFacturaViva(f: PFCEstadoRow["proveedor_facturas"]): boolean {
  if (!f) return false;
  if (f.deleted_at) return false;
  return (f.estado ?? "").toLowerCase() !== "cancelada";
}

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
    .select("concepto_costo_id, proveedor_facturas(estado, deleted_at)")
    .in("concepto_costo_id", ids);
  if (errPfc) throw errPfc;

  // SAFE-CAST: shape modelado por PFCEstadoRow a partir del select con embed.
  const rows = (pfc ?? []) as unknown as PFCEstadoRow[];
  const set = new Set<string>();
  for (const r of rows) {
    if (r.concepto_costo_id && esFacturaViva(r.proveedor_facturas)) set.add(r.concepto_costo_id);
  }
  return set;
}
