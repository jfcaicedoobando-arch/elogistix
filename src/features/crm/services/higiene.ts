/**
 * Servicio CRM — Higiene del pipeline (Etapa 2 CRM Hunter).
 * Lee las RPC `crm_higiene_pipeline` y `crm_higiene_oportunidades`, que ya
 * respetan RLS del usuario (SECURITY INVOKER).
 */
import { supabase } from "@/integrations/supabase/client";

import type { HigieneResumen, HigieneOportunidad } from "../types/higiene";
export type { EstadoHigiene, HigieneResumen, HigieneOportunidad } from "../types/higiene";
const RESUMEN_VACIO: HigieneResumen = {
  abiertas: 0,
  registros_completos: 0,
  higiene_pct: 0,
  seguimiento_oportuno_pct: 0,
  vencidas: 0,
  sin_actividad_programada: 0,
  pipeline_bruto: 0,
  pipeline_ponderado: 0,
  tc_fecha: null,
  tc_estimado: false,
};

export async function fetchHigieneResumen(): Promise<HigieneResumen> {
  const { data, error } = await supabase.rpc("crm_higiene_pipeline");
  if (error) throw error;
  const fila = Array.isArray(data) ? data[0] : data;
  return { ...RESUMEN_VACIO, ...(fila ?? {}) } as HigieneResumen;
}

export async function fetchHigieneOportunidades(): Promise<HigieneOportunidad[]> {
  const { data, error } = await supabase.rpc("crm_higiene_oportunidades");
  if (error) throw error;
  return (data ?? []) as HigieneOportunidad[];
}

