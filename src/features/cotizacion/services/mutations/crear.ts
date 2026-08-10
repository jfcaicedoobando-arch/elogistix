import { supabase } from "@/integrations/supabase/client";
import type { CotizacionRow, CreateCotizacionInput } from "@/features/cotizacion/types";
import { fromDbChecked } from "@/lib/supabase/cast";
import { cotizacionRowDbSchema } from "../readSchemas";

import { cotizacionDraftInputSchema, parseOrThrow } from "@/lib/validation/mutationSchemas";
import { buildCotizacionInsertPayload } from "./payloadBuilders";
import { registrarActividad } from "@/services/bitacora/registrar";

/**
 * v13.303.0 (FIX-05): folio atómico vía RPC `siguiente_folio_cotizacion()`.
 * La RPC deriva la organización del `current_user_org_id()` — no hace falta
 * pasarla desde el cliente. Antes el folio se calculaba con `MAX + 1`
 * lexicográfico, con dos bugs:
 *   - race condition (dos altas concurrentes → mismo folio), y
 *   - `10000` < `9999` en orden por texto → tras `COT-YYYY-9999` todos
 *     los folios nuevos colisionaban en `COT-YYYY-10000`.
 */
async function generarFolioAtomico(): Promise<string> {
  const { data, error } = await supabase.rpc("siguiente_folio_cotizacion");
  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("No se pudo generar el folio de cotización");
  }
  return data;
}

export async function crearCotizacion(input: CreateCotizacionInput): Promise<CotizacionRow> {
  parseOrThrow(cotizacionDraftInputSchema, input, "Cotización");
  const folio = await generarFolioAtomico();
  // Ola 10 · A11: la vigencia se calcula desde "hoy" en zona CDMX. Con
  // `toISOString()` cualquier alta después de las 18:00 hora de México
  // guardaba la fecha del día siguiente (la cotización vencía un día tarde).
  const base = parseLocalMx(hoyMx());
  base.setUTCDate(base.getUTCDate() + input.vigencia_dias);
  const payload = buildCotizacionInsertPayload(input, folio, isoUtcDay(base));

  const { data, error } = await supabase
    .from("cotizaciones")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  const cotizacion = fromDbChecked<CotizacionRow>(data, cotizacionRowDbSchema);
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "crear_cotizacion",
    entidadId: cotizacion.id,
    entidadNombre: cotizacion.folio,
  });
  return cotizacion;
}
