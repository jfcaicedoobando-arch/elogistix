/**
 * CRUD del catálogo de puertos (UN/LOCODE).
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrapOr, run } from "@/lib/supabase/response";
import { warnIfTruncated } from "@/lib/supabase/assertNotTruncated";
import { LIMITE_CATALOGOS, type Puerto } from "./catalogosTypes";
import { fetchDesactivadosOrg, setActivoOrg } from "./catalogoOrgVisibilidad";

export async function fetchPuertos(includeInactive = false): Promise<Puerto[]> {
  let query = supabase.from("puertos").select("*").order("country").order("name").limit(LIMITE_CATALOGOS);
  if (!includeInactive) query = query.eq("activo", true);
  const rows = fromDb<Puerto[]>(await unwrapOr(query, []));
  warnIfTruncated(rows, LIMITE_CATALOGOS, "catalogos.fetchPuertos");
  const apagados = await fetchDesactivadosOrg("puertos");
  if (!includeInactive) return rows.filter((r) => !apagados.has(r.id));
  return rows.map((r) => ({ ...r, activoOrg: r.activo && !apagados.has(r.id) }));
}

export async function insertPuerto(input: { code: string; name: string; country: string }): Promise<void> {
  await run(supabase.from("puertos").insert(input));
}

/** Enciende/apaga el puerto SÓLO para la empresa activa (el catálogo es global). */
export async function setPuertoActivo(id: string, activo: boolean): Promise<void> {
  await setActivoOrg("puertos", id, activo);
}

export async function deletePuerto(id: string): Promise<void> {
  const filas = await unwrapOr(
    supabase.from("puertos").delete().eq("id", id).select("id"),
    [] as { id: string }[],
  );
  if (filas.length === 0) {
    throw new Error("No tienes permisos para eliminar puertos.");
  }
}
