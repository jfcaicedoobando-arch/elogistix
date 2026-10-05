/** Lectura completa de los vínculos que sustentan la facturación por costo. */
import { supabase } from "@/integrations/supabase/client";
import { chunkIds } from "@/lib/supabase/chunkedIn";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
import { CAP_LOTES_DURO } from "@/constants/queryCaps";
import { ResultadoTruncadoError } from "@/lib/supabase/assertNotTruncated";
import type { PFCRow } from "./reconciliacionCostos.tipos";

/** RLS permanece activa y los IDs provienen de los costos visibles del reporte. */
export async function fetchVinculosReconciliacion(
  conceptoIds: string[],
  organizationId?: string | null,
): Promise<PFCRow[]> {
  const rows: PFCRow[] = [];
  for (const ids of chunkIds(conceptoIds)) {
    const lote = await leerTodasLasPaginas("embarques.vinculosReconciliacion", (ini, fin) => {
      let query = supabase.from("proveedor_facturas_conceptos")
        .select("monto, cantidad, concepto_costo_id, descripcion, proveedor_facturas(id, folio_interno, folio_proveedor, fecha_emision, fecha_vencimiento, estado, estado_aprobacion, moneda, tipo_cambio_usd, deleted_at)")
        .in("concepto_costo_id", ids);
      if (organizationId) query = query.eq("organization_id", organizationId);
      return query.order("id").range(ini, fin);
    });
    // SAFE-CAST: el select explícito corresponde a PFCRow.
    rows.push(...lote as unknown as PFCRow[]);
    if (rows.length >= CAP_LOTES_DURO) {
      throw new ResultadoTruncadoError("embarques.vinculosReconciliacion", CAP_LOTES_DURO);
    }
  }
  return rows;
}
