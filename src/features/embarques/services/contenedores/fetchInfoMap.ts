/**
 * I/O puro: devuelve un map `embarque_id -> { count, primero, incompletos }`
 * con los contenedores hijos para una lista de embarques.
 *
 * Encapsula el SELECT y el conteo de incompletos (sin número o sin tipo)
 * para que la capa de hooks no importe `supabase` directamente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ContenedoresInfo {
  count: number;
  primero: string;
  /** Contenedores hijos sin número o sin tipo capturado. */
  incompletos: number;
}

export type ContenedoresInfoMap = Record<string, ContenedoresInfo>;

function isVacio(v: string | null | undefined): boolean {
  return !v || v.trim() === "";
}

export async function fetchContenedoresInfoMap(
  embarqueIds: string[],
): Promise<ContenedoresInfoMap> {
  if (embarqueIds.length === 0) return {};
  const { data, error } = await supabase
    .from("embarque_contenedores")
    .select("embarque_id, numero_contenedor, tipo_contenedor, orden")
    .in("embarque_id", embarqueIds)
    .is("deleted_at", null)
    .order("orden", { ascending: true });
  if (error) throw error;
  const map: ContenedoresInfoMap = {};
  for (const row of data ?? []) {
    const eid = row.embarque_id;
    if (!map[eid]) {
      map[eid] = { count: 0, primero: row.numero_contenedor ?? "", incompletos: 0 };
    }
    map[eid].count += 1;
    if (isVacio(row.numero_contenedor) || isVacio(row.tipo_contenedor)) {
      map[eid].incompletos += 1;
    }
  }
  return map;
}
