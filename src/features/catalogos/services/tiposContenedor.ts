/**
 * CRUD del catálogo de tipos de contenedor.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrapOr, run } from "@/lib/supabase/response";
import { warnIfTruncated } from "@/lib/supabase/assertNotTruncated";
import { LIMITE_CATALOGOS, type TipoContenedor } from "./catalogosTypes";

export async function fetchTiposContenedor(includeInactive = false): Promise<TipoContenedor[]> {
  let query = supabase.from("tipos_contenedor").select("*").order("name").limit(LIMITE_CATALOGOS);
  if (!includeInactive) query = query.eq("activo", true);
  const rows = fromDb<TipoContenedor[]>(await unwrapOr(query, []));
  warnIfTruncated(rows, LIMITE_CATALOGOS, "catalogos.fetchTiposContenedor");
  return rows;
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
