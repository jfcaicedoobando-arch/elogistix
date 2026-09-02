/**
 * CRUD del catálogo de tipos de contenedor.
 *
 * P1 (2026-09-02): la lista de ACTIVOS se deduplica por clave semántica
 * canónica para que los selectores no muestren dos opciones idénticas con IDs
 * distintos. No se borra nada: cada opción conserva `idsEquivalentes`.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrapOr, run } from "@/lib/supabase/response";
import { warnIfTruncated } from "@/lib/supabase/assertNotTruncated";
import { LIMITE_CATALOGOS, type TipoContenedor } from "./catalogosTypes";
import {
  dedupeTiposContenedor,
  type TipoContenedorCanonico,
} from "@/features/catalogos/utils/tiposContenedorCanonico";

export async function fetchTiposContenedor(
  includeInactive = false,
): Promise<TipoContenedorCanonico[]> {
  let query = supabase.from("tipos_contenedor").select("*").order("name").limit(LIMITE_CATALOGOS);
  if (!includeInactive) query = query.eq("activo", true);
  const rows = fromDb<TipoContenedor[]>(await unwrapOr(query, []));
  warnIfTruncated(rows, LIMITE_CATALOGOS, "catalogos.fetchTiposContenedor");
  // La vista de administración debe seguir viendo TODOS los registros (para
  // poder desactivar el duplicado); sólo la lista de selección se colapsa.
  if (includeInactive) return rows.map((r) => ({ ...r, idsEquivalentes: [r.id] }));
  return dedupeTiposContenedor(rows);
}

export async function insertTipoContenedor(input: { code: string; name: string }): Promise<void> {
  await run(supabase.from("tipos_contenedor").insert(input));
}

export async function setTipoContenedorActivo(id: string, activo: boolean): Promise<void> {
  await run(supabase.from("tipos_contenedor").update({ activo }).eq("id", id));
}

export async function deleteTipoContenedor(id: string): Promise<void> {
  await run(supabase.from("tipos_contenedor").delete().eq("id", id));
}
