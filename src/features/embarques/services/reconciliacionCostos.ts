/**
 * Conciliación cotizado vs real por embarque (Fase 2) — capa Supabase.
 * Lógica pura en `./reconciliacionCostos.helpers` (matemática + clasificación).
 */
import { supabase } from "@/integrations/supabase/client";
import { chunkIds } from "@/lib/supabase/chunkedIn";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
import { CAP_LOTES_DURO } from "@/constants/queryCaps";
import { ResultadoTruncadoError } from "@/lib/supabase/assertNotTruncated";
import { fetchVinculosReconciliacion } from "./reconciliacionCostos.lecturas";
import { contarPartidasHuerfanas, type PartidaParaHuerfanas } from "./reconciliacionCostos.huerfanas";
import {
  buildFilasReconciliacion,
  type CCRow,
  type FilaReconciliacion,
} from "./reconciliacionCostos.helpers";

export * from "./reconciliacionCostos.helpers";

export async function fetchReconciliacionEmbarque(
  embarqueId: string,
): Promise<FilaReconciliacion[]> {
  if (!embarqueId) return [];
  const cc = await leerTodasLasPaginas("embarques.costosReconciliacion", (ini, fin) => supabase
      .from("conceptos_costo")
      .select("id, embarque_id, concepto, proveedor_nombre, moneda, monto, origen, estado_liquidacion")
      .eq("embarque_id", embarqueId)
      .is("deleted_at", null)
      .order("id").range(ini, fin));
  // SAFE-CAST: shape modelado por CCRow a partir del select explícito de columnas arriba.
  const conceptos = (cc ?? []) as unknown as CCRow[];
  if (conceptos.length === 0) return [];

  const ids = conceptos.map((c) => c.id);
  const pfc = await fetchVinculosReconciliacion(ids);
  return buildFilasReconciliacion(conceptos, pfc);
}

/**
 * Cuenta partidas de proveedor "huérfanas" para un embarque: PFC ligadas a
 * una factura vigente de este embarque sin vínculo operativo válido. Una línea
 * fiscal NULL es legítima si su factura tiene un costo activo vinculado aquí.
 * Los vínculos a otro embarque, eliminados o invisibles sí son huérfanos.
 */
export async function fetchPartidasHuerfanasCount(embarqueId: string): Promise<number> {
  if (!embarqueId) return 0;
  const facturas = await leerTodasLasPaginas("embarques.facturasParaHuerfanas", (ini, fin) => supabase
    .from("proveedor_facturas")
    .select("id")
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null)
    .neq("estado", "Cancelada")
    .neq("estado_aprobacion", "rechazada")
    .order("id").range(ini, fin));
  const fids = (facturas ?? []).map((f) => f.id).filter((x): x is string => Boolean(x));
  if (fids.length === 0) return 0;

  const rows: PartidaParaHuerfanas[] = [];
  for (const lote of chunkIds(fids)) {
    const data = await leerTodasLasPaginas("embarques.partidasParaHuerfanas", (ini, fin) => supabase
      .from("proveedor_facturas_conceptos")
      .select("proveedor_factura_id, concepto_costo_id, conceptos_costo(embarque_id, deleted_at, origen)")
      .in("proveedor_factura_id", lote)
      .order("id").range(ini, fin));
    // SAFE-CAST: columnas y embed corresponden a PartidaParaHuerfanas.
    rows.push(...data as unknown as PartidaParaHuerfanas[]);
    if (rows.length >= CAP_LOTES_DURO) throw new ResultadoTruncadoError("embarques.partidasParaHuerfanas", CAP_LOTES_DURO);
  }
  return contarPartidasHuerfanas(rows, embarqueId);
}
