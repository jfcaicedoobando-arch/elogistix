import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { CreateCotizacionInput } from "@/features/cotizacion/types";
import { fromDb, toDbJson } from "@/lib/supabase/cast";
import { cotizacionUpdateSchema, parseOrThrow } from "@/lib/validation/mutationSchemas";
import { registrarActividad } from "@/services/bitacora/registrar";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";
import type { CotizacionInsert } from "./payloadBuilders";

type CotizacionUpdate = Partial<CotizacionInsert>;

/**
 * Normaliza el payload de UPDATE: JSON de conceptos/dimensiones, enums y la
 * vigencia derivada de la validez propuesta. Extraído de `updateCotizacion`
 * (Power-of-10: complejidad ≤16).
 */
function construirPayloadUpdate(data: Partial<CreateCotizacionInput>): CotizacionUpdate {
  const updatePayload = fromDb<CotizacionUpdate>({ ...data });
  // Ola 18: la validez propuesta manda sobre la vigencia mostrada (detalle y
  // PDF). El trigger `_cotizaciones_sync_vigencia` es la red de seguridad en BD.
  if (data.validez_propuesta) updatePayload.fecha_vigencia = data.validez_propuesta;
  if (data.conceptos_venta) updatePayload.conceptos_venta = toDbJson(data.conceptos_venta);
  if (data.dimensiones_lcl) updatePayload.dimensiones_lcl = toDbJson(data.dimensiones_lcl);
  if (data.dimensiones_aereas) updatePayload.dimensiones_aereas = toDbJson(data.dimensiones_aereas);
  if (data.modo) updatePayload.modo = data.modo as TablesInsert<"cotizaciones">["modo"];
  if (data.tipo) updatePayload.tipo = data.tipo as TablesInsert<"cotizaciones">["tipo"];
  if (data.incoterm) updatePayload.incoterm = data.incoterm as TablesInsert<"cotizaciones">["incoterm"];
  if (data.moneda) updatePayload.moneda = data.moneda as TablesInsert<"cotizaciones">["moneda"];
  return updatePayload;
}

export async function updateCotizacion(
  id: string,
  data: Partial<CreateCotizacionInput>,
  /**
   * N-06 (QA r2): bloqueo optimista. `updated_at` leído al abrir el wizard; si
   * la fila ya cambió en otra sesión el UPDATE no toca ninguna fila y se lanza
   * LC_CONFLICTO_CONCURRENCIA en vez de pisar el trabajo ajeno.
   */
  expectedUpdatedAt?: string | null,
): Promise<string | null> {
  parseOrThrow(cotizacionUpdateSchema, data, "No se pudo actualizar la cotización");
  const updatePayload = construirPayloadUpdate(data);
  let query = supabase.from("cotizaciones").update(updatePayload).eq("id", id);
  // v13.823.15: la base firma la fila al insertarla, así que `updated_at` nunca
  // es `null`. La rama `.is("updated_at", null)` sólo producía conflictos
  // falsos: sin sello (null/undefined) se guarda sin bloqueo optimista.
  const conGuard = !!expectedUpdatedAt;
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { data: filas, error } = await query.select("updated_at");
  if (error) throw error;
  if (!filas || filas.length === 0) {
    if (conGuard) throw conflictoConcurrenciaError();

    throw new Error(
      "No se guardaron los cambios de la cotización: no tienes permiso o la cotización ya no existe.",
    );
  }

  await registrarActividad({
    modulo: "cotizaciones",
    accion: "editar_cotizacion",
    entidadId: id,
    detalles: { campos: Object.keys(data) },
  });
  return filas[0]?.updated_at ?? null;
}
