/**
 * Servicio CRM — Higiene del pipeline (Etapa 2 CRM Hunter).
 * Lee las RPC `crm_higiene_pipeline` y `crm_higiene_oportunidades`, que ya
 * respetan RLS del usuario (SECURITY INVOKER).
 */
import { supabase } from "@/integrations/supabase/client";

export type EstadoHigiene = "en_tiempo" | "por_vencer" | "vencida";

export interface HigieneResumen {
  abiertas: number;
  registros_completos: number;
  higiene_pct: number;
  seguimiento_oportuno_pct: number;
  vencidas: number;
  sin_actividad_programada: number;
  pipeline_bruto: number;
  pipeline_ponderado: number;
}

export interface HigieneOportunidad {
  id: string;
  nombre: string;
  cliente_nombre: string | null;
  etapa_id: string;
  etapa_nombre: string;
  vendedor_email: string | null;
  monto_estimado: number | null;
  moneda: string | null;
  probabilidad: number | null;
  fecha_estimada_cierre: string | null;
  ultimo_movimiento_at: string;
  dias_sin_movimiento: number;
  sla_dias: number;
  estado_higiene: EstadoHigiene;
  registro_completo: boolean;
  proxima_actividad_at: string | null;
  actividad_vencida: boolean;
}

const RESUMEN_VACIO: HigieneResumen = {
  abiertas: 0,
  registros_completos: 0,
  higiene_pct: 0,
  seguimiento_oportuno_pct: 0,
  vencidas: 0,
  sin_actividad_programada: 0,
  pipeline_bruto: 0,
  pipeline_ponderado: 0,
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

export interface EmbudoEtapa {
  etapa_id: string;
  etapa_nombre: string;
  orden: number;
  probabilidad_default: number | null;
  oportunidades: number;
  valor: number;
  ponderado: number;
  entradas: number;
  conversion_desde_anterior: number | null;
}

export async function fetchEmbudoConversion(desde: string, hasta: string): Promise<EmbudoEtapa[]> {
  const { data, error } = await supabase.rpc("crm_embudo_conversion", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  return (data ?? []) as EmbudoEtapa[];
}

export interface AvanceActividad {
  vendedor_email: string;
  contactos: number;
  contactos_efectivos: number;
  reuniones_calificadas: number;
  cotizaciones: number;
}

export async function fetchAvanceActividad(desde: string, hasta: string): Promise<AvanceActividad[]> {
  const { data, error } = await supabase.rpc("crm_avance_actividad", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  return (data ?? []) as AvanceActividad[];
}
