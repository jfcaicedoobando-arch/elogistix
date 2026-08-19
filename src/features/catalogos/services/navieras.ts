/**
 * CRUD del catálogo de navieras.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrapOr, run } from "@/lib/supabase/response";
import { warnIfTruncated } from "@/lib/supabase/assertNotTruncated";
import { registrarActividad } from "@/services/bitacora/registrar";
import { LIMITE_CATALOGOS, type Naviera } from "./catalogosTypes";

export async function fetchNavieras(includeInactive = false): Promise<Naviera[]> {
  // 12.34.0: .limit(CAP_LISTA) defensivo (evita el cap silencioso de 1000 de PostgREST).
  let query = supabase.from("navieras").select("*").order("name").limit(LIMITE_CATALOGOS);
  if (!includeInactive) query = query.eq("activo", true);
  const rows = fromDb<Naviera[]>(await unwrapOr(query, []));
  warnIfTruncated(rows, LIMITE_CATALOGOS, "catalogos.fetchNavieras");
  return rows;
}

export async function insertNaviera(input: { code: string; name: string }): Promise<void> {
  await run(supabase.from("navieras").insert(input));
}

export async function setNavieraActivo(id: string, activo: boolean): Promise<void> {
  await run(supabase.from("navieras").update({ activo }).eq("id", id));
}

export async function deleteNaviera(id: string): Promise<void> {
  await run(supabase.from("navieras").delete().eq("id", id));
}

/**
 * Q-13: edición de código/nombre de una naviera desde el catálogo admin.
 * NOTA: alta/activación/baja de navieras, puertos y tipos de contenedor ya
 * se registran en bitácora desde `createCatalogHooks` (hook compartido); no
 * se duplica aquí. `updateNaviera` no pasa por ese hook, así que se registra.
 */
export async function updateNaviera(id: string, input: { code: string; name: string }): Promise<void> {
  await run(supabase.from("navieras").update(input).eq("id", id));
  await registrarActividad({
    modulo: "catalogos",
    accion: "editar_navieras",
    entidadId: id,
    entidadNombre: input.name,
    detalles: { code: input.code },
  });
}
