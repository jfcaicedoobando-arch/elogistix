/**
 * Mutaciones de `crm_oportunidades` (crear, actualizar, mover etapa, eliminar).
 * Extraído de `oportunidades.ts` (Power of 10 — límite de líneas por archivo).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase/response";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";
import { buildOportunidadInsertPayload } from "@/features/crm/domain/oportunidadPayload";
import type { OportunidadInput } from "@/features/crm/types/oportunidades";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";

export async function crearOportunidad(
  input: OportunidadInput,
  user: { id?: string; email?: string } | null,
): Promise<{ id: string; avisoActividad: string | null }> {
  const payload = buildOportunidadInsertPayload(input, user);
  const creada = (await unwrap(
    supabase.from("crm_oportunidades").insert(payload).select("id").single(),
  )) as { id: string };
  // v13.823.32: la oportunidad YA existe. Si el registro automático de
  // actividad/bitácora falla, no la perdemos ni anunciamos fracaso: se
  // devuelve un aviso accionable para la UI.
  let avisoActividad: string | null = null;
  try {
    await registrarActividad({
      modulo: "crm",
      accion: "crear_oportunidad",
      entidadId: creada.id,
      entidadNombre: input.nombre ?? "",
    });
  } catch (err) {
    avisoActividad = err instanceof Error ? err.message : "Error desconocido";
  }
  return { id: creada.id, avisoActividad };
}

/**
 * v13.823.32: un UPDATE filtrado por RLS o sobre una oportunidad ya eliminada
 * NO da error, devuelve 0 filas. Antes mostrábamos éxito y escribíamos bitácora
 * de un cambio que nunca ocurrió. Ahora se exige la fila afectada.
 *
 * Hallazgo 14 (auditoría): bloqueo optimista igual al patrón del wizard de
 * cotizaciones (`useCotizacionUpdateGuard`). Si se manda `expectedUpdatedAt` y
 * el UPDATE no afecta ninguna fila, otro usuario ya modificó la oportunidad:
 * se lanza LC_CONFLICTO_CONCURRENCIA en vez de aplicar cambios parciales.
 * Devuelve el `updated_at` resultante para resincronizar el sello del caller.
 */
export async function actualizarOportunidadFilas(
  id: string,
  patch: TablesUpdate<"crm_oportunidades">,
  expectedUpdatedAt?: string | null,
): Promise<string | undefined> {
  let query = supabase
    .from("crm_oportunidades")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await query.select("id, updated_at").maybeSingle();
  if (error) throw error;
  if (!data) {
    if (expectedUpdatedAt) throw conflictoConcurrenciaError();
    throw new Error(
      "No se pudo guardar la oportunidad: no tienes permiso o la oportunidad ya no existe.",
    );
  }
  return (data as { updated_at?: string }).updated_at;
}

export async function actualizarOportunidad(input: {
  id: string;
  patch: Partial<OportunidadInput & { motivo_perdida_id?: string | null; fecha_cierre_real?: string | null }>;
  expectedUpdatedAt?: string | null;
}): Promise<string | undefined> {
  const updatedAt = await actualizarOportunidadFilas(input.id, input.patch, input.expectedUpdatedAt);
  await registrarActividad({
    modulo: "crm",
    accion: "editar_oportunidad",
    entidadId: input.id,
    detalles: { campos: Object.keys(input.patch) },
  });
  return updatedAt;
}

export async function moverEtapaOportunidad(input: {
  id: string;
  etapa_id: string;
  probabilidad?: number;
  // B-034: cierre real cuando la etapa destino es "ganada" (kanban DnD).
  fecha_cierre_real?: string | null;
  valor_real?: number | null;
  // Ola 4 · N49: limpieza al salir de "perdida".
  motivo_perdida_id?: string | null;
  expectedUpdatedAt?: string | null;
}): Promise<string | undefined> {
  const patch: {
    etapa_id: string;
    probabilidad?: number;
    fecha_cierre_real?: string | null;
    valor_real?: number | null;
    motivo_perdida_id?: string | null;
  } = { etapa_id: input.etapa_id };
  if (typeof input.probabilidad === "number") patch.probabilidad = input.probabilidad;
  // Ola 4 · N49: `null` explícito SÍ se escribe — al salir de "ganada" el
  // cierre real se limpia (antes el guard truthy lo ignoraba y quedaba una
  // oportunidad abierta con fecha/valor de cierre).
  if (input.fecha_cierre_real !== undefined) patch.fecha_cierre_real = input.fecha_cierre_real;
  if (input.valor_real !== undefined) patch.valor_real = input.valor_real;
  if (input.motivo_perdida_id !== undefined) patch.motivo_perdida_id = input.motivo_perdida_id;
  const updatedAt = await actualizarOportunidadFilas(input.id, patch, input.expectedUpdatedAt);
  await registrarActividad({
    modulo: "crm",
    accion: "mover_etapa_oportunidad",
    entidadId: input.id,
    detalles: { etapa_id: input.etapa_id, valor_real: input.valor_real ?? null },
  });
  return updatedAt;
}

export async function eliminarOportunidad(id: string, userId: string | null): Promise<void> {
  await actualizarOportunidadFilas(id, {
    deleted_at: new Date().toISOString(),
    deleted_by: userId,
  });
  await registrarActividad({
    modulo: "crm",
    accion: "eliminar_oportunidad",
    entidadId: id,
  });
}
