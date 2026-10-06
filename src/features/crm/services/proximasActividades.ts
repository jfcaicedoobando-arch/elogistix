/**
 * Servicio CRM — Próximas actividades por entidad (batch lookup).
 */
import { supabase } from "@/integrations/supabase/client";
import { buildProximasMap } from "@/features/crm/domain/proximasActividades";


import type { ProximaActividad, CrmEntidadTipo } from "../types/actividades";
export type { ProximaActividad } from "../types/actividades";

import { CRM_ACTIVIDADES_COLUMNS_MIN as COLS } from "./crmActividadesColumns";
import { CAP_LISTA } from "@/constants/queryCaps";

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
    .limit(CAP_LISTA);
  if (error) throw error;
  return buildProximasMap((data ?? []) as ProximaActividad[]);
}
