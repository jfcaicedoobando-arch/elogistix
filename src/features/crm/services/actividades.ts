/**
 * Servicio CRM — Actividades. Capa de I/O para `crm_actividades`.
 */
import { supabase } from "@/integrations/supabase/client";
import { ilikePattern, quoteOrValue } from "@/lib/search/ilike";
import { unwrap, unwrapOr } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { Database } from "@/integrations/supabase/types";

export type CrmActividadRow = Database["public"]["Tables"]["crm_actividades"]["Row"];
export type CrmActividadTipo = Database["public"]["Enums"]["crm_actividad_tipo"];
export type CrmEntidadTipo = Database["public"]["Enums"]["crm_entidad_tipo"];

import { CRM_ACTIVIDADES_COLUMNS_FULL as COLS, CRM_ACTIVIDADES_COLUMNS_MIN } from "./crmActividadesColumns";

export type ActividadSortKey = "fecha_programada" | "tipo" | "asunto" | "created_at";
export const ACTIVIDAD_SORTABLE_KEYS = ["fecha_programada", "tipo", "asunto", "created_at"] as const;

export interface ListActividadesParams {
  search: string;
  tipo: CrmActividadTipo | "todos";
  estado: "pendientes" | "completadas" | "todas";
  responsable: "mias" | "todos";
  entidadTipo?: CrmEntidadTipo;
  entidadId?: string;
  page: number;
  pageSize: number;
  userId?: string;
  sortKey?: ActividadSortKey;
  sortDir?: "asc" | "desc";
  /**
   * v13.823.49 — `?filtro=vencidas` filtraba en cliente sobre la página ya
   * paginada, así que el contador y la paginación no correspondían al conjunto
   * vencido. Ahora el filtro (`fecha_programada < ahora`) va en la consulta.
   */
  vencidas?: boolean;
}

export async function listActividades(p: ListActividadesParams): Promise<{ data: CrmActividadRow[]; count: number }> {
  // Retiene el patrón manual: PostgREST devuelve `count` fuera de `data`,
  // así que `unwrap`/`unwrapOr` (que sólo mapean data) no aplica.
  const sortKey = p.sortKey ?? "fecha_programada";
  const sortDir = p.sortDir ?? "asc";
  let q = supabase
    .from("crm_actividades")
    .select(COLS, { count: "exact" })
    .is("deleted_at", null)
    .order(sortKey, { ascending: sortDir === "asc", nullsFirst: false })
    // EC-02: desempate estable para que la paginación no duplique ni omita
    // filas cuando varias actividades comparten el mismo `sortKey`.
    .order("id", { ascending: sortDir === "asc" });

  if (p.search.trim()) q = q.ilike("asunto", ilikePattern(p.search));
  if (p.tipo !== "todos") q = q.eq("tipo", p.tipo);
  if (p.estado === "pendientes") q = q.is("fecha_completada", null);
  if (p.estado === "completadas") q = q.not("fecha_completada", "is", null);
  if (p.responsable === "mias" && p.userId) q = q.eq("responsable_id", p.userId);
  if (p.entidadTipo) q = q.eq("entidad_tipo", p.entidadTipo);
  if (p.entidadId) q = q.eq("entidad_id", p.entidadId);
  if (p.vencidas) {
    q = q.is("fecha_completada", null).lt("fecha_programada", new Date().toISOString());
    if (p.userId) q = q.eq("responsable_id", p.userId);
  }
  const from = p.page * p.pageSize;
  q = q.range(from, from + p.pageSize - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data ?? []) as CrmActividadRow[], count: count ?? 0 };
}

export type CrearActividadInput = {
  tipo: CrmActividadTipo;
  asunto: string;
  descripcion?: string;
  entidad_tipo: CrmEntidadTipo;
  entidad_id: string;
  fecha_programada?: string | null;
  duracion_min?: number | null;
  resultado?: string;
  /** Calidad del contacto (hoja 04_Actividades del CRM Hunter). */
  contacto_efectivo?: boolean;
  reunion_calificada?: boolean;
};

export async function crearActividad(
  input: CrearActividadInput,
  user: { id?: string; email?: string } | null,
): Promise<{ id: string }> {
  const creada = (await unwrap(
    supabase
      .from("crm_actividades")
      .insert({
        ...input,
        descripcion: input.descripcion ?? "",
        resultado: input.resultado ?? "",
        responsable_id: user?.id ?? null,
        responsable_email: user?.email ?? "",
        created_by: user?.id ?? null,
      })
      .select("id")
      .single(),
  )) as { id: string };
  await registrarActividad({
    modulo: "crm",
    accion: "Creó actividad",
    entidadId: creada.id,
    entidadNombre: input.asunto,
    detalles: { tipo: input.tipo, entidad_tipo: input.entidad_tipo, entidad_id: input.entidad_id },
  });
  return creada;
}

/**
 * v13.823.49 — un UPDATE filtrado por RLS o sobre una actividad eliminada NO
 * da error: devuelve 0 filas. Antes reportábamos éxito y escribíamos bitácora
 * de un cambio que nunca ocurrió.
 */
async function exigirFilaActividad(
  builder: PromiseLike<{ data: { id: string } | null; error: unknown }>,
): Promise<void> {
  const { data, error } = await builder;
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se pudo guardar la actividad: no tienes permiso o la actividad ya no existe.",
    );
  }
}

export async function completarActividad(input: { id: string; resultado?: string }): Promise<void> {
  await exigirFilaActividad(
    supabase
      .from("crm_actividades")
      .update({ fecha_completada: new Date().toISOString(), resultado: input.resultado ?? "" })
      .eq("id", input.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle(),
  );
  await registrarActividad({ modulo: "crm", accion: "Completó actividad", entidadId: input.id });
}

export async function posponerActividad(input: {
  id: string;
  dias: number;
  fechaProgramada: string | null;
}): Promise<void> {
  const base = input.fechaProgramada ? new Date(input.fechaProgramada) : new Date();
  base.setDate(base.getDate() + input.dias);
  await exigirFilaActividad(
    supabase
      .from("crm_actividades")
      .update({ fecha_programada: base.toISOString() })
      .eq("id", input.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle(),
  );
  await registrarActividad({ modulo: "crm", accion: "Pospuso actividad", entidadId: input.id, detalles: { dias: input.dias } });
}


export async function actualizarActividadNotas(input: { id: string; resultado: string }): Promise<void> {
  await exigirFilaActividad(
    supabase
      .from("crm_actividades")
      .update({ resultado: input.resultado })
      .eq("id", input.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle(),
  );
  await registrarActividad({ modulo: "crm", accion: "Actualizó notas de actividad", entidadId: input.id });
}


// B-055: las actividades pueden tener solo responsable_email (sin id); el
// filtro "mías" debe cubrir ambas llaves.
// B-24: `quoteOrValue` protege el `.or()` de PostgREST — un valor con `,`, `(`,
// `)` o `"` rompería el parser.
const filtroResponsable = (userId: string, email?: string | null) =>
  email
    ? `responsable_id.eq.${userId},responsable_email.eq.${quoteOrValue(email)}`
    : `responsable_id.eq.${userId}`;

export async function countActividadesVencidas(userId: string, email?: string | null): Promise<number> {
  // `count` va fuera de `data` — mantenemos el patrón manual.
  const { count, error } = await supabase
    .from("crm_actividades")
    .select("id", { count: "exact", head: true })
    .is("fecha_completada", null)
    .is("deleted_at", null)
    .lt("fecha_programada", new Date().toISOString())
    .or(filtroResponsable(userId, email));
  if (error) throw error;
  return count ?? 0;
}

export type ActividadVencida = {
  id: string;
  asunto: string;
  tipo: string;
  fecha_programada: string | null;
  entidad_tipo: string;
  entidad_id: string;
};

export async function listActividadesVencidas(userId: string, limit: number, email?: string | null): Promise<ActividadVencida[]> {
  return unwrapOr(
    supabase
      .from("crm_actividades")
      .select(CRM_ACTIVIDADES_COLUMNS_MIN)
      .is("fecha_completada", null)
      .is("deleted_at", null)
      .lt("fecha_programada", new Date().toISOString())
      .or(filtroResponsable(userId, email))
      .order("fecha_programada", { ascending: true })
      .limit(limit),
    [] as ActividadVencida[],
  ) as Promise<ActividadVencida[]>;
}
