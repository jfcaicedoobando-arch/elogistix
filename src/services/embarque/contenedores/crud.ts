/**
 * CRUD de embarque_contenedores (Fase B del refactor 1 embarque ↔ N).
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ContenedorBorrador,
  EmbarqueContenedor,
  EmbarqueContenedorInsert,
} from "@/types/embarque/contenedor";

export async function listarPorEmbarque(
  embarqueId: string,
): Promise<EmbarqueContenedor[]> {
  const { data, error } = await supabase
    .from("embarque_contenedores")
    .select("*")
    .eq("embarque_id", embarqueId)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function crear(
  embarqueId: string,
  borrador: ContenedorBorrador,
): Promise<EmbarqueContenedor> {
  const insert: EmbarqueContenedorInsert = {
    embarque_id: embarqueId,
    numero_contenedor: borrador.numero_contenedor,
    tipo_contenedor: borrador.tipo_contenedor,
    bl_house: borrador.bl_house,
    peso_kg: borrador.peso_kg,
    volumen_m3: borrador.volumen_m3,
    piezas: borrador.piezas,
    orden: borrador.orden,
  };
  const { data, error } = await supabase
    .from("embarque_contenedores")
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function crearMuchos(
  embarqueId: string,
  borradores: ContenedorBorrador[],
): Promise<EmbarqueContenedor[]> {
  if (borradores.length === 0) return [];
  const rows: EmbarqueContenedorInsert[] = borradores.map((b, i) => ({
    embarque_id: embarqueId,
    numero_contenedor: b.numero_contenedor,
    tipo_contenedor: b.tipo_contenedor,
    bl_house: b.bl_house,
    peso_kg: b.peso_kg,
    volumen_m3: b.volumen_m3,
    piezas: b.piezas,
    orden: b.orden || i + 1,
  }));
  const { data, error } = await supabase
    .from("embarque_contenedores")
    .insert(rows)
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function actualizar(
  id: string,
  cambios: Partial<ContenedorBorrador>,
): Promise<EmbarqueContenedor> {
  const { data, error } = await supabase
    .from("embarque_contenedores")
    .update({
      numero_contenedor: cambios.numero_contenedor,
      tipo_contenedor: cambios.tipo_contenedor,
      bl_house: cambios.bl_house,
      peso_kg: cambios.peso_kg,
      volumen_m3: cambios.volumen_m3,
      piezas: cambios.piezas,
      orden: cambios.orden,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminar(id: string): Promise<void> {
  // Soft-delete (la policy restrictiva esconde deleted_at NOT NULL).
  const { error } = await supabase
    .from("embarque_contenedores")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Reemplaza todos los contenedores del embarque por la lista dada.
 * Patrón delete+insert para sincronizar edición masiva desde UI.
 * Nota: rompe FKs en conceptos_venta.contenedor_id y conceptos_costo.contenedor_id.
 * Para edición preservando IDs usar `sincronizarContenedores`.
 */
export async function reemplazarTodos(
  embarqueId: string,
  borradores: ContenedorBorrador[],
): Promise<EmbarqueContenedor[]> {
  const { error: delError } = await supabase
    .from("embarque_contenedores")
    .update({ deleted_at: new Date().toISOString() })
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null);
  if (delError) throw delError;
  return crearMuchos(embarqueId, borradores);
}

/**
 * Sincroniza la lista preservando IDs cuando coinciden.
 * Útil para edición del wizard sin romper FKs de conceptos_*.contenedor_id.
 */
export async function sincronizarContenedores(
  embarqueId: string,
  borradores: ContenedorBorrador[],
): Promise<EmbarqueContenedor[]> {
  const actuales = await listarPorEmbarque(embarqueId);
  const idsConservados = new Set(
    borradores.map((b) => b.id).filter((id): id is string => Boolean(id)),
  );

  const paraEliminar = actuales
    .filter((a) => !idsConservados.has(a.id))
    .map((a) => a.id);
  if (paraEliminar.length > 0) {
    const { error } = await supabase
      .from("embarque_contenedores")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", paraEliminar);
    if (error) throw error;
  }

  await Promise.all(
    borradores
      .filter((b) => b.id)
      .map((b) => actualizar(b.id!, b)),
  );

  const nuevos = borradores.filter((b) => !b.id);
  if (nuevos.length > 0) {
    await crearMuchos(embarqueId, nuevos);
  }

  return listarPorEmbarque(embarqueId);
}
