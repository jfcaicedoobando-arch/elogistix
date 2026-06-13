/**
 * Servicio CRM — Próximas actividades por entidad (batch lookup).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { buildProximasMap } from "@/features/crm/domain/proximasActividades";

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

export async function fetchProximasActividades(
  entidadTipo: CrmEntidadTipo,
  entidadIds: string[],
): Promise<Map<string, ProximaActividad>> {
  const { data, error } = await supabase
    .from("crm_actividades")
    .select(COLS)
    .eq("entidad_tipo", entidadTipo)
    .in("entidad_id", entidadIds)
    .is("fecha_completada", null)
    .is("deleted_at", null)
    .order("fecha_programada", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw error;
  return buildProximasMap((data ?? []) as ProximaActividad[]);
}
