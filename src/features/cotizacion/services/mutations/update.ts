import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { CreateCotizacionInput } from "@/features/cotizacion/types";
import { fromDb, toDbJson } from "@/lib/supabase/cast";
import { cotizacionUpdateSchema, parseOrThrow } from "@/lib/validation/mutationSchemas";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { CotizacionInsert } from "./payloadBuilders";

type CotizacionUpdate = Partial<CotizacionInsert>;

export async function updateCotizacion(
  id: string,
  data: Partial<CreateCotizacionInput>,
): Promise<void> {
  parseOrThrow(cotizacionUpdateSchema, data, "No se pudo actualizar la cotización");
  const updatePayload = fromDb<CotizacionUpdate>({ ...data });
  // Ola 18: la validez propuesta manda sobre la vigencia mostrada (detalle y
  // PDF). Antes `fecha_vigencia` quedaba congelada en el cálculo del alta
  // (emisión + 15 días) y divergía de la fecha capturada. El trigger
  // `_cotizaciones_sync_vigencia` es la red de seguridad en BD.
  if (data.validez_propuesta) updatePayload.fecha_vigencia = data.validez_propuesta;

  if (data.conceptos_venta) updatePayload.conceptos_venta = toDbJson(data.conceptos_venta);
  if (data.dimensiones_lcl) updatePayload.dimensiones_lcl = toDbJson(data.dimensiones_lcl);
  if (data.dimensiones_aereas)
    updatePayload.dimensiones_aereas = toDbJson(data.dimensiones_aereas);
  if (data.modo) updatePayload.modo = data.modo as TablesInsert<"cotizaciones">["modo"];
  if (data.tipo) updatePayload.tipo = data.tipo as TablesInsert<"cotizaciones">["tipo"];
  if (data.incoterm)
    updatePayload.incoterm = data.incoterm as TablesInsert<"cotizaciones">["incoterm"];
  if (data.moneda) updatePayload.moneda = data.moneda as TablesInsert<"cotizaciones">["moneda"];
  const { error } = await supabase.from("cotizaciones").update(updatePayload).eq("id", id);
  if (error) throw error;
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "editar_cotizacion",
    entidadId: id,
    detalles: { campos: Object.keys(data) },
  });
}
