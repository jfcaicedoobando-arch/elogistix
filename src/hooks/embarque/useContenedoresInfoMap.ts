/**
 * Devuelve un map `embarque_id -> { count, primero, incompletos }` con los
 * contenedores hijos de `embarque_contenedores` para una lista de embarques
 * visibles.
 *
 * Usado por la tabla de embarques para mostrar el primer contenedor real,
 * un badge `+N` cuando hay más de uno y un indicador "Datos pendientes"
 * cuando algún hijo carece de número o tipo de contenedor capturado
 * (v12.14.1).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContenedoresInfo {
  count: number;
  primero: string;
  /** Contenedores hijos sin número o sin tipo capturado. */
  incompletos: number;
}

export type ContenedoresInfoMap = Record<string, ContenedoresInfo>;

const QUERY_KEY = "embarque-contenedores-info-map" as const;

function isVacio(v: string | null | undefined): boolean {
  return !v || v.trim() === "";
}

export function useContenedoresInfoMap(embarqueIds: string[]) {
  const ids = [...embarqueIds].sort();
  return useQuery<ContenedoresInfoMap, Error>({
    queryKey: [QUERY_KEY, ids],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("embarque_contenedores")
        .select("embarque_id, numero_contenedor, tipo_contenedor, orden")
        .in("embarque_id", ids)
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
    },
  });
}
