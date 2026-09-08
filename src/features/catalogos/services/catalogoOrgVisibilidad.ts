/**
 * Visibilidad por empresa de los catálogos GLOBALES (puertos, navieras y
 * tipos de contenedor).
 *
 * Los catálogos son compartidos por todas las empresas, así que su columna
 * `activo` es global y sólo la mueve la plataforma. Cada empresa decide qué
 * elementos quiere ver mediante una lista de apagados propia
 * (`catalogo_org_desactivado`): apagar = insertar la fila, encender = borrarla.
 * Nunca se modifica el catálogo global.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr, run } from "@/lib/supabase/response";

export type CatalogoOrg = "puertos" | "navieras" | "tipos_contenedor";

/** IDs del catálogo que esta empresa tiene apagados. */
export async function fetchDesactivadosOrg(catalogo: CatalogoOrg): Promise<Set<string>> {
  const filas = await unwrapOr(
    supabase.from("catalogo_org_desactivado").select("item_id").eq("catalogo", catalogo),
    [] as { item_id: string }[],
  );
  return new Set(filas.map((f) => f.item_id));
}

/**
 * Enciende o apaga un elemento del catálogo SÓLO para la empresa activa.
 * Es idempotente: apagar dos veces no falla, encender algo ya encendido tampoco.
 */
export async function setActivoOrg(
  catalogo: CatalogoOrg,
  itemId: string,
  activo: boolean,
): Promise<void> {
  if (activo) {
    await run(
      supabase.from("catalogo_org_desactivado").delete().eq("catalogo", catalogo).eq("item_id", itemId),
    );
    return;
  }
  const { error } = await supabase.from("catalogo_org_desactivado").insert({ catalogo, item_id: itemId });
  // 23505 = ya estaba apagado para esta empresa: el resultado deseado ya existe.
  if (error && error.code !== "23505") throw error;
}
