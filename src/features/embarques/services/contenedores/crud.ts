/**
 * CRUD de embarque_contenedores (Fase B del refactor 1 embarque ↔ N).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr, run } from "@/lib/supabase/response";
import type {
  ContenedorBorrador,
  EmbarqueContenedor,
  EmbarqueContenedorInsert,
} from "@/features/embarques/types/contenedor";

/**
 * v13.312.9 (Sentry JAVASCRIPT-REACT-1M/3H): traduce el error de violación
 * de unicidad de `uq_embarque_contenedor_numero` a un mensaje amigable.
 * Analogía: si intentas etiquetar dos cajas con el mismo número, avisamos
 * en español en vez de mostrar el error crudo de la base de datos.
 */
function traducirErrorContenedorDuplicado(err: unknown): Error {
  const e = err as { code?: string; message?: string; details?: string } | null;
  const blob = `${e?.message ?? ""} ${e?.details ?? ""}`;
  if (e?.code === "23505" && /uq_embarque_contenedor_numero/i.test(blob)) {
    const match = /=\(([^,]+),\s*([^)]+)\)/.exec(e?.details ?? "");
    const numero = match?.[2]?.trim();
    return new Error(
      numero
        ? `El contenedor "${numero}" ya está registrado en este embarque.`
        : "Ese número de contenedor ya está registrado en este embarque.",
    );
  }
  return err instanceof Error ? err : new Error(String(e?.message ?? err));
}

export async function listarPorEmbarque(
  embarqueId: string,
): Promise<EmbarqueContenedor[]> {
  return unwrapOr(
    supabase
      .from("embarque_contenedores")
      .select("*")
      .eq("embarque_id", embarqueId)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
    [],
  );
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
  return unwrapOr(
    supabase.from("embarque_contenedores").insert(rows).select(),
    [],
  );
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
  await run(
    supabase
      .from("embarque_contenedores")
      .update({ deleted_at: new Date().toISOString() })
      .eq("embarque_id", embarqueId)
      .is("deleted_at", null),
  );
  return crearMuchos(embarqueId, borradores);
}

/**
 * Sincroniza la lista preservando IDs cuando coinciden.
 * C-4: usa RPC atómica para evitar dejar el embarque sin hijos si falla a media operación.
 */
export async function sincronizarContenedores(
  embarqueId: string,
  borradores: ContenedorBorrador[],
): Promise<EmbarqueContenedor[]> {
  const payload = borradores.map((b, i) => ({
    id: b.id ?? null,
    numero_contenedor: b.numero_contenedor,
    tipo_contenedor: b.tipo_contenedor,
    bl_house: b.bl_house ?? null,
    peso_kg: b.peso_kg ?? null,
    volumen_m3: b.volumen_m3 ?? null,
    piezas: b.piezas ?? null,
    orden: b.orden || i + 1,
  }));

  return unwrapOr(
    supabase.rpc("sincronizar_contenedores_embarque", {
      p_embarque_id: embarqueId,
      // SAFE-CAST: jsonb param tipado en supabase types como Json
      p_contenedores: payload as never,
    }),
    [],
  ) as Promise<EmbarqueContenedor[]>;
}
