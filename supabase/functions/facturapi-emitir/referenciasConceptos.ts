/** Referencias descriptivas para nuevas emisiones; no modifica documentos guardados. */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse } from "../_shared/response.ts";
import type { ConceptoInterno, ReferenciasEmbarque } from "./helpers.ts";
import type { FacturaRow } from "./types.ts";

interface EmbarqueReferencias extends ReferenciasEmbarque { id: string }

/** Lee una sola vez cada origen. La cabecera no representa una factura fusionada. */
export async function cargarReferenciasConceptos(
  supabase: SupabaseClient,
  factura: FacturaRow,
  conceptos: ConceptoInterno[],
): Promise<ConceptoInterno[] | Response> {
  const ids = [...new Set(conceptos.flatMap((c) => c.embarque_id ? [c.embarque_id] : []))];
  // Compatibilidad con facturas antiguas cuyos renglones no guardaban origen.
  if (ids.length === 0) return conceptos;

  const { data, error } = await supabase.from("embarques")
    .select("id, expediente, bl_master, bl_house")
    .eq("organization_id", factura.organization_id)
    .in("id", ids);
  if (error) return jsonResponse({
    error: "referencias_embarque_query_failed",
    message: "No se pudieron leer las referencias de los conceptos. Intenta de nuevo antes de timbrar.",
  }, 500);

  const porId = new Map((data as EmbarqueReferencias[] | null ?? []).map((e) => [e.id, e]));
  return conceptos.map((c) => ({
    ...c,
    // Un origen ausente/inaccesible o una línea manual no toma el primero.
    referencias: c.embarque_id ? porId.get(c.embarque_id) ?? null : null,
  }));
}
