/**
 * Servicio CRM — Oportunidades. Capa de I/O para `crm_oportunidades`.
 */
import { supabase } from "@/integrations/supabase/client";
import { orIlike } from "@/lib/search/ilike";
import { unwrap } from "@/lib/supabase/response";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";
import { buildOportunidadInsertPayload } from "@/features/crm/domain/oportunidadPayload";
export type { CrmOportunidadRow, Moneda, OportunidadInput } from "@/features/crm/types/oportunidades";
import type { CrmOportunidadRow, OportunidadInput } from "@/features/crm/types/oportunidades";

const COLS =
  "id, nombre, cliente_id, cliente_nombre, lead_id, vendedor_id, vendedor_email, etapa_id, monto_estimado, valor_real, moneda, probabilidad, fecha_estimada_cierre, fecha_cierre_real, motivo_perdida_id, modo, tipo_carga, origen, destino, notas, monto_meta, fecha_meta_cierre, compromiso_nota, margen_pct, margen_autorizado_por, margen_autorizado_at, riesgos_objeciones, cotizacion_ganadora_id, embarque_ganador_id, created_at, updated_at";

export interface ListOportunidadesParams {
  search: string;
  etapaId: string | "todas";
  vendedorId: string | "todos";
  page: number;
  pageSize: number;
}

export async function listOportunidades(p: ListOportunidadesParams): Promise<{ data: CrmOportunidadRow[]; count: number }> {
  let q = supabase
    .from("crm_oportunidades")
    .select(COLS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    // EC-02: desempate estable para que la paginación no duplique ni omita
    // filas cuando varias oportunidades comparten el mismo `created_at`.
    .order("id", { ascending: false });

  if (p.search.trim()) {
    q = q.or(orIlike(["nombre", "cliente_nombre"], p.search));
  }
  if (p.etapaId !== "todas") q = q.eq("etapa_id", p.etapaId);
  if (p.vendedorId !== "todos") q = q.eq("vendedor_id", p.vendedorId);
  const from = p.page * p.pageSize;
  q = q.range(from, from + p.pageSize - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data ?? []) as CrmOportunidadRow[], count: count ?? 0 };
}

export async function getOportunidad(id: string): Promise<CrmOportunidadRow | null> {
  // Soft-delete: el detalle por URL directa tampoco puede resolver una
  // oportunidad eliminada (la ruta muestra "no encontrada" con `null`).
  return unwrap(
    supabase
      .from("crm_oportunidades")
      .select(COLS)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
  ) as Promise<CrmOportunidadRow | null>;
}

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
 */
async function actualizarOportunidadFilas(
  id: string,
  patch: TablesUpdate<"crm_oportunidades">,
): Promise<void> {
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se pudo guardar la oportunidad: no tienes permiso o la oportunidad ya no existe.",
    );
  }
}

export async function actualizarOportunidad(input: {
  id: string;
  patch: Partial<OportunidadInput & { motivo_perdida_id?: string | null; fecha_cierre_real?: string | null }>;
}): Promise<void> {
  await actualizarOportunidadFilas(input.id, input.patch);
  await registrarActividad({
    modulo: "crm",
    accion: "editar_oportunidad",
    entidadId: input.id,
    detalles: { campos: Object.keys(input.patch) },
  });
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
}): Promise<void> {
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
  await actualizarOportunidadFilas(input.id, patch);
  await registrarActividad({
    modulo: "crm",
    accion: "mover_etapa_oportunidad",
    entidadId: input.id,
    detalles: { etapa_id: input.etapa_id, valor_real: input.valor_real ?? null },
  });
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

