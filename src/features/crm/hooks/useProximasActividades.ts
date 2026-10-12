/**
 * useProximasActividades — devuelve la actividad pendiente más próxima
 * por entidad en una sola query (batch lookup para Kanban/listas).
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/query";
import {
  fetchProximasActividades,
  type ProximaActividad,
} from "@/features/crm/services/proximasActividades";

type CrmEntidadTipo = Database["public"]["Enums"]["crm_entidad_tipo"];

export type { ProximaActividad } from "@/features/crm/services/proximasActividades";

export function useProximasActividades(
  entidadTipo: CrmEntidadTipo,
  entidadIds: string[],
) {
  const ids = [...entidadIds].sort();
  return useQuery({
    queryKey: queryKeys.crm.proximasActividades(entidadTipo, ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
    // Conservar el lote anterior sólo al consultar el mismo tipo de entidad.
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === entidadTipo ? keepPreviousData(previousData) : undefined,
    queryFn: (): Promise<Map<string, ProximaActividad>> =>
      fetchProximasActividades(entidadTipo, ids),
  });
}
