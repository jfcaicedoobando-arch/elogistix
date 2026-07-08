/**
 * Conciliación cotizado vs real por embarque (Fase 2) — capa Supabase.
 * Lógica pura en `./reconciliacionCostos.helpers` (matemática + clasificación).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  buildFilasReconciliacion,
  type CCRow,
  type FilaReconciliacion,
  type PFCRow,
} from "./reconciliacionCostos.helpers";

export * from "./reconciliacionCostos.helpers";

export async function fetchReconciliacionEmbarque(
  embarqueId: string,
): Promise<FilaReconciliacion[]> {
  if (!embarqueId) return [];
  const { data: cc, error: errCc } = await supabase
    .from("conceptos_costo")
    .select("id, concepto, proveedor_nombre, moneda, monto, estado_liquidacion")
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null);
  if (errCc) throw errCc;
  // SAFE-CAST: shape modelado por CCRow a partir del select explícito de columnas arriba.
  const conceptos = (cc ?? []) as unknown as CCRow[];
  if (conceptos.length === 0) return [];

  const ids = conceptos.map((c) => c.id);
  const { data: pfc, error: errPfc } = await supabase
    .from("proveedor_facturas_conceptos")
    .select("monto, concepto_costo_id, descripcion, proveedor_facturas(id, folio_proveedor, fecha_emision, fecha_vencimiento, estado, deleted_at)")
    .in("concepto_costo_id", ids);
  if (errPfc) throw errPfc;
  // SAFE-CAST: shape modelado por PFCRow a partir del select con embed.
  return buildFilasReconciliacion(conceptos, (pfc ?? []) as unknown as PFCRow[]);
}

/**
 * Cuenta partidas de proveedor "huérfanas" para un embarque: PFC ligadas a
 * una factura de este embarque, pero cuyo `concepto_costo_id` es NULL o apunta
 * a un concepto de OTRO embarque (data drift).
 */
export async function fetchPartidasHuerfanasCount(embarqueId: string): Promise<number> {
  if (!embarqueId) return 0;
  const { data: facturas, error: errFa } = await supabase
    .from("proveedor_facturas")
    .select("id")
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null);
  if (errFa) throw errFa;
  const fids = (facturas ?? []).map((f) => f.id).filter((x): x is string => Boolean(x));
  if (fids.length === 0) return 0;

  const { data: pfc, error: errPfc } = await supabase
    .from("proveedor_facturas_conceptos")
    .select("concepto_costo_id, conceptos_costo(embarque_id)")
    .in("proveedor_factura_id", fids);
  if (errPfc) throw errPfc;

  type Row = { concepto_costo_id: string | null; conceptos_costo: { embarque_id: string | null } | null };
  // SAFE-CAST: embed de conceptos_costo(embarque_id) modelado localmente por Row.
  const rows = (pfc ?? []) as unknown as Row[];
  let huerfanas = 0;
  for (const r of rows) {
    if (!r.concepto_costo_id) { huerfanas += 1; continue; }
    if (!r.conceptos_costo || r.conceptos_costo.embarque_id !== embarqueId) huerfanas += 1;
  }
  return huerfanas;
}
