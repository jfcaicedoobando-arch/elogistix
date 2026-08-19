/**
 * CRUD del catálogo de puertos (UN/LOCODE).
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrapOr, run } from "@/lib/supabase/response";
import { warnIfTruncated } from "@/lib/supabase/assertNotTruncated";
import { LIMITE_CATALOGOS, type Puerto } from "./catalogosTypes";

export async function fetchPuertos(includeInactive = false): Promise<Puerto[]> {
  let query = supabase.from("puertos").select("*").order("country").order("name").limit(LIMITE_CATALOGOS);
  if (!includeInactive) query = query.eq("activo", true);
  const rows = fromDb<Puerto[]>(await unwrapOr(query, []));
  warnIfTruncated(rows, LIMITE_CATALOGOS, "catalogos.fetchPuertos");
  return rows;
}

export async function insertPuerto(input: { code: string; name: string; country: string }): Promise<void> {
  await run(supabase.from("puertos").insert(input));
}

export async function setPuertoActivo(id: string, activo: boolean): Promise<void> {
  // `.select("id")` permite detectar el caso "0 filas afectadas" (RLS sin permiso),
  // que Postgres NO reporta como error y antes fallaba en silencio.
  const filas = await unwrapOr(
    supabase.from("puertos").update({ activo }).eq("id", id).select("id"),
    [] as { id: string }[],
  );
  if (filas.length === 0) {
    throw new Error("No tienes permisos para activar o desactivar puertos.");
  }
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
