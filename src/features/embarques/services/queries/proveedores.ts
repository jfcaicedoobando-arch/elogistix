/**
 * Lectura ligera del catálogo de proveedores para selects y wizards.
 * Vive en `services/embarque` porque es donde se consume (conceptos costo).
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchProveedoresForSelect(organizationId: string | null) {
  // 12.34.0: .limit(500) defensivo (evita cap silencioso de 1000 PostgREST).
  let query = supabase
    .from("proveedores")
    .select("id, nombre")
    .is("deleted_at", null)
    .order("nombre")
    .limit(500);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export interface ProveedorDelEmbarque {
  id: string;
  nombre: string;
}

/**
 * Proveedores que ya aparecen en los costos vivos del embarque.
 * Se usa para que el operador escoja rápido al subir una factura al buzón.
 */
export async function fetchProveedoresDelEmbarque(
  embarqueId: string,
): Promise<ProveedorDelEmbarque[]> {
  const { data, error } = await supabase
    .from("conceptos_costo")
    .select("proveedor_id, proveedor_nombre")
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null)
    .limit(500);
  if (error) throw error;
  return dedupeProveedores(data ?? []);
}

/** Deduplica por id y ordena por nombre (locale MX). */
export function dedupeProveedores(
  filas: ReadonlyArray<{ proveedor_id: string | null; proveedor_nombre: string | null }>,
): ProveedorDelEmbarque[] {
  const mapa = new Map<string, string>();
  for (const fila of filas) {
    if (!fila.proveedor_id) continue;
    const previo = mapa.get(fila.proveedor_id);
    if (!previo || (!previo.trim() && fila.proveedor_nombre)) {
      mapa.set(fila.proveedor_id, fila.proveedor_nombre ?? "Proveedor sin nombre");
    }
  }
  return Array.from(mapa, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es-MX"),
  );
}
