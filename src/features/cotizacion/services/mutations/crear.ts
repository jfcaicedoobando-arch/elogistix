import { supabase } from "@/integrations/supabase/client";
import type { CotizacionRow, CreateCotizacionInput } from "@/features/cotizacion/types";
import { fromDb } from "@/lib/supabase/cast";
import { cotizacionDraftInputSchema, parseOrThrow } from "@/lib/validation/mutationSchemas";
import { buildCotizacionInsertPayload } from "./payloadBuilders";

/**
 * v13.303.0 (FIX-05): el folio se obtiene vía RPC `siguiente_folio_cotizacion`
 * (atómica, usa `folio_secuencias`). Antes se leía el máximo con `.order("folio")`
 * lexicográfico, lo que:
 *   - generaba race conditions (dos usos concurrentes → mismo folio), y
 *   - fallaba con `COT-YYYY-9999` porque el orden por texto devolvía 9999
 *     para siempre (`10000` < `9999` lexicográficamente).
 */
async function generarFolioAtomico(organizationId: string): Promise<string> {
  const { data, error } = await supabase.rpc("siguiente_folio_cotizacion", {
    p_org_id: organizationId,
  });
  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("No se pudo generar el folio de cotización");
  }
  return data;
}

export async function crearCotizacion(input: CreateCotizacionInput): Promise<CotizacionRow> {
  parseOrThrow(cotizacionDraftInputSchema, input, "Cotización");
  if (!input.organization_id) {
    throw new Error("Falta organization_id para generar folio de cotización");
  }
  const folio = await generarFolioAtomico(input.organization_id);
  const fechaVigencia = new Date();
  fechaVigencia.setDate(fechaVigencia.getDate() + input.vigencia_dias);
  const payload = buildCotizacionInsertPayload(
    input,
    folio,
    fechaVigencia.toISOString().split("T")[0],
  );

  const { data, error } = await supabase
    .from("cotizaciones")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return fromDb<CotizacionRow>(data);
}
