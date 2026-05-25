/**
 * useProximasActividades — devuelve la actividad pendiente más próxima
 * por entidad en una sola query (batch lookup para Kanban/listas).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { buildProximasMap } from "@/lib/crm/proximasActividades";

type CrmEntidadTipo = Database["public"]["Enums"]["crm_entidad_tipo"];

export interface ProximaActividad {
  id: string;
  entidad_tipo: CrmEntidadTipo;
  entidad_id: string;
  tipo: Database["public"]["Enums"]["crm_actividad_tipo"];
  asunto: string;
  fecha_programada: string | null;
}

const COLS = "id, entidad_tipo, entidad_id, tipo, asunto, fecha_programada";

export function useProximasActividades(
  entidadTipo: CrmEntidadTipo,
  entidadIds: string[],
) {
  const ids = [...entidadIds].sort();
  return useQuery({
    queryKey: ["crm", "proximas-actividades", entidadTipo, ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, ProximaActividad>> => {
      const { data, error } = await supabase
        .from("crm_actividades")
        .select(COLS)
        .eq("entidad_tipo", entidadTipo)
        .in("entidad_id", ids)
        .is("fecha_completada", null)
        .is("deleted_at", null)
        .order("fecha_programada", { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return buildProximasMap((data ?? []) as ProximaActividad[]);
    },
  });
}

