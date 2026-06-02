/**
 * CRUD de categorías presupuestales.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type CategoriaPresupuesto = Tables<"presupuesto_categorias">;

export async function fetchCategorias(activas = true): Promise<CategoriaPresupuesto[]> {
  let q = supabase
    .from("presupuesto_categorias")
    .select("*")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (activas) q = q.eq("activa", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CategoriaPresupuesto[];
}

export async function crearCategoria(payload: TablesInsert<"presupuesto_categorias">) {
  const { data, error } = await supabase
    .from("presupuesto_categorias")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarCategoria(
  id: string, patch: TablesUpdate<"presupuesto_categorias">,
) {
  const { data, error } = await supabase
    .from("presupuesto_categorias")
    .update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarCategoria(id: string) {
  const { error } = await supabase.from("presupuesto_categorias").delete().eq("id", id);
  if (error) throw error;
}

export async function seedCategoriasDefault(organizationId: string): Promise<void> {
  const { error } = await supabase.rpc("seed_presupuesto_categorias", {
    p_organization_id: organizationId,
  });
  if (error) throw error;
}
