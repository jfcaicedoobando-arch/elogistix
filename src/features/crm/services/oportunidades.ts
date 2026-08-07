/**
 * Servicio CRM — Oportunidades. Capa de I/O para `crm_oportunidades`.
 */
import { supabase } from "@/integrations/supabase/client";
import { orIlike } from "@/lib/search/ilike";
import { unwrap, run } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";
import { buildOportunidadInsertPayload } from "@/features/crm/domain/oportunidadPayload";
export type { CrmOportunidadRow, Moneda, OportunidadInput } from "@/features/crm/types/oportunidades";
import type { CrmOportunidadRow, OportunidadInput } from "@/features/crm/types/oportunidades";

const COLS =
  "id, nombre, cliente_id, cliente_nombre, lead_id, vendedor_id, vendedor_email, etapa_id, monto_estimado, valor_real, moneda, probabilidad, fecha_estimada_cierre, fecha_cierre_real, motivo_perdida_id, modo, tipo_carga, origen, destino, notas, cotizacion_ganadora_id, embarque_ganador_id, created_at, updated_at";

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
    .order("created_at", { ascending: false });
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
  return unwrap(
    supabase.from("crm_oportunidades").select(COLS).eq("id", id).maybeSingle(),
  ) as Promise<CrmOportunidadRow | null>;
}

export async function crearOportunidad(
  input: OportunidadInput,
  user: { id?: string; email?: string } | null,
): Promise<{ id: string }> {
  const payload = buildOportunidadInsertPayload(input, user);
  const creada = (await unwrap(
    supabase.from("crm_oportunidades").insert(payload).select("id").single(),
  )) as { id: string };
  await registrarActividad({
    modulo: "crm",
    accion: "crear_oportunidad",
    entidadId: creada.id,
    entidadNombre: input.nombre ?? "",
  });
  return creada;
}

export async function actualizarOportunidad(input: {
  id: string;
  patch: Partial<OportunidadInput & { motivo_perdida_id?: string | null; fecha_cierre_real?: string | null }>;
}): Promise<void> {
  await run(supabase.from("crm_oportunidades").update(input.patch).eq("id", input.id));
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
}): Promise<void> {
  const patch: {
    etapa_id: string;
    probabilidad?: number;
    fecha_cierre_real?: string;
    valor_real?: number;
  } = { etapa_id: input.etapa_id };
  if (typeof input.probabilidad === "number") patch.probabilidad = input.probabilidad;
  if (input.fecha_cierre_real) patch.fecha_cierre_real = input.fecha_cierre_real;
  if (typeof input.valor_real === "number") patch.valor_real = input.valor_real;
  await run(supabase.from("crm_oportunidades").update(patch).eq("id", input.id));
  await registrarActividad({
    modulo: "crm",
    accion: "mover_etapa_oportunidad",
    entidadId: input.id,
    detalles: { etapa_id: input.etapa_id, valor_real: input.valor_real ?? null },
  });
}

export async function eliminarOportunidad(id: string, userId: string | null): Promise<void> {
  await run(
    supabase
      .from("crm_oportunidades")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", id),
  );
  await registrarActividad({
    modulo: "crm",
    accion: "eliminar_oportunidad",
    entidadId: id,
  });
}
