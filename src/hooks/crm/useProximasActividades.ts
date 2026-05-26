/**
 * useProximasActividades — devuelve la actividad pendiente más próxima
 * por entidad en una sola query (batch lookup para Kanban/listas).
 */
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/query";
import {
  fetchProximasActividades,
  type ProximaActividad,
} from "@/services/crm/proximasActividades";

type CrmEntidadTipo = Database["public"]["Enums"]["crm_entidad_tipo"];

export type { ProximaActividad } from "@/services/crm/proximasActividades";

export function useProximasActividades(
  entidadTipo: CrmEntidadTipo,
  entidadIds: string[],
) {
  const ids = [...entidadIds].sort();
  return useQuery({
    queryKey: queryKeys.crm.proximasActividades(entidadTipo, ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: (): Promise<Map<string, ProximaActividad>> =>
      fetchProximasActividades(entidadTipo, ids),
  });
}
