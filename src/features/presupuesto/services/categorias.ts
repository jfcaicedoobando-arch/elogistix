/**
 * CRUD de categorías presupuestales.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";

export type CategoriaPresupuesto = Tables<"presupuesto_categorias">;

export async function fetchCategorias(
  activas = true,
  organizationId?: string | null,
): Promise<CategoriaPresupuesto[]> {
  let q = supabase
    .from("presupuesto_categorias")
    .select("*")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (activas) q = q.eq("activa", true);
  // Defensa en profundidad multi-tenant (Fase 3): además de RLS, filtramos
  // explícitamente por organización para evitar mezcla si RLS falla o el rol
  // es de servicio. Alineado con el resto del módulo Presupuesto.
  if (organizationId) q = q.eq("organization_id", organizationId);
  return unwrapOr(q, []) as Promise<CategoriaPresupuesto[]>;
}

export async function crearCategoria(
  payload: TablesInsert<"presupuesto_categorias">,
): Promise<CategoriaPresupuesto> {
  const categoria = (await unwrap(
    supabase.from("presupuesto_categorias").insert(payload).select().single(),
  )) as CategoriaPresupuesto;
  await registrarActividad({
    modulo: "configuracion",
    accion: "Creó categoría de presupuesto",
    entidadId: categoria.id,
    entidadNombre: categoria.nombre,
  });
  return categoria;
}

export async function actualizarCategoria(
  id: string, patch: TablesUpdate<"presupuesto_categorias">,
): Promise<CategoriaPresupuesto> {
  const categoria = (await unwrap(
    supabase.from("presupuesto_categorias").update(patch).eq("id", id).select().single(),
  )) as CategoriaPresupuesto;
  await registrarActividad({
    modulo: "configuracion",
    accion: "Actualizó categoría de presupuesto",
    entidadId: id,
    entidadNombre: categoria.nombre,
    detalles: { campos: Object.keys(patch) },
  });
  return categoria;
}

export async function eliminarCategoria(id: string): Promise<void> {
  await run(supabase.from("presupuesto_categorias").delete().eq("id", id));
  await registrarActividad({
    modulo: "configuracion",
    accion: "Eliminó categoría de presupuesto",
    entidadId: id,
  });
}

export async function seedCategoriasDefault(organizationId: string): Promise<void> {
  await run(
    supabase.rpc("seed_presupuesto_categorias", { p_organization_id: organizationId }),
  );
}
