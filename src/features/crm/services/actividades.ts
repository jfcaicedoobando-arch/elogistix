/**
 * Servicio CRM — Actividades. Capa de I/O para `crm_actividades`.
 */
import { supabase } from "@/integrations/supabase/client";
import { ilikePattern } from "@/lib/search/ilike";
import { unwrapOr } from "@/lib/supabase/response";
import type { Database } from "@/integrations/supabase/types";

export type CrmActividadRow = Database["public"]["Tables"]["crm_actividades"]["Row"];
export type CrmActividadTipo = Database["public"]["Enums"]["crm_actividad_tipo"];
export type CrmEntidadTipo = Database["public"]["Enums"]["crm_entidad_tipo"];

import { CRM_ACTIVIDADES_COLUMNS_FULL as COLS, CRM_ACTIVIDADES_COLUMNS_MIN } from "./crmActividadesColumns";
import { filtroResponsable, aplicarResponsableYVencidas, SIN_RESULTADOS } from "./actividadesQueryHelpers";
export {
  crearActividad,
  completarActividad,
  posponerActividad,
  actualizarActividadNotas,
  type CrearActividadInput,
} from "./actividadesMutations";

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
  userEmail?: string | null;
  sortKey?: ActividadSortKey;
  sortDir?: "asc" | "desc";
  /**
   * v13.823.49 — `?filtro=vencidas` filtraba en cliente sobre la página ya
   * paginada, así que el contador y la paginación no correspondían al conjunto
   * vencido. Ahora el filtro (`fecha_programada < ahora`) va en la consulta.
   */
  vencidas?: boolean;
}

export { filtroResponsable };

export async function listActividades(p: ListActividadesParams): Promise<{ data: CrmActividadRow[]; count: number }> {
  // Retiene el patrón manual: PostgREST devuelve `count` fuera de `data`,
  // así que `unwrap`/`unwrapOr` (que sólo mapean data) no aplica.
  // v13.823.51 — falla cerrado: si el filtro personal (o el atajo de vencidas)
  // está activo pero la sesión aún no resolvió el usuario, NO se consulta toda
  // la organización; se devuelve vacío en lugar de "Mías" del equipo.
  if ((p.responsable === "mias" || p.vencidas) && !p.userId) return SIN_RESULTADOS;
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
  // v13.823.50 — "Mías" usa la misma llave que el badge de vencidas
  // (`responsable_id` O `responsable_email`): hay filas históricas con sólo
  // email y el contador las incluía mientras la tabla las ocultaba.

  if (p.entidadTipo) q = q.eq("entidad_tipo", p.entidadTipo);
  if (p.entidadId) q = q.eq("entidad_id", p.entidadId);
  q = aplicarResponsableYVencidas(q, p);
  const from = p.page * p.pageSize;
  q = q.range(from, from + p.pageSize - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data ?? []) as CrmActividadRow[], count: count ?? 0 };
}

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
