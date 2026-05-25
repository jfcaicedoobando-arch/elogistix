import { supabase } from "@/integrations/supabase/client";
import type { CotizacionRow, CreateCotizacionInput } from "@/types/cotizacion";
import { fromDb } from "@/lib/supabase/cast";
import { cotizacionInputSchema, parseOrThrow } from "@/lib/validation/mutationSchemas";
import { generarFolioCotizacion } from "../queries";
import { buildCotizacionInsertPayload } from "./payloadBuilders";

export async function crearCotizacion(input: CreateCotizacionInput): Promise<CotizacionRow> {
  parseOrThrow(cotizacionInputSchema, input, "Cotización");
  const folio = await generarFolioCotizacion();
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
