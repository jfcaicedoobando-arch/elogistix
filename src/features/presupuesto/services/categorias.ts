/**
 * CRUD de categorías presupuestales.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";

export type CategoriaPresupuesto = Tables<"presupuesto_categorias">;

export async function fetchCategorias(activas = true): Promise<CategoriaPresupuesto[]> {
  let q = supabase
    .from("presupuesto_categorias")
    .select("*")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (activas) q = q.eq("activa", true);
  return unwrapOr(q, []) as Promise<CategoriaPresupuesto[]>;
}

export async function crearCategoria(payload: TablesInsert<"presupuesto_categorias">) {
  return unwrap(
    supabase.from("presupuesto_categorias").insert(payload).select().single(),
  );
}

export async function actualizarCategoria(
  id: string, patch: TablesUpdate<"presupuesto_categorias">,
) {
  return unwrap(
    supabase.from("presupuesto_categorias").update(patch).eq("id", id).select().single(),
  );
}

export async function eliminarCategoria(id: string) {
  await run(supabase.from("presupuesto_categorias").delete().eq("id", id));
}

export async function seedCategoriasDefault(organizationId: string): Promise<void> {
  await run(
    supabase.rpc("seed_presupuesto_categorias", { p_organization_id: organizationId }),
  );
}
