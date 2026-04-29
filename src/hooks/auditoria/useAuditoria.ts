import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReglaAuditoria =
  | "docs_faltantes"
  | "docs_pendientes_avanzado"
  | "fechas"
  | "ventas_sin_facturar";

export type SeveridadAuditoria = "critico" | "alto" | "medio";

export interface HallazgoAuditoria {
  embarque_id: string;
  expediente: string;
  cliente_nombre: string;
  modo: string;
  estado: string;
  eta: string | null;
  regla: ReglaAuditoria;
  severidad: SeveridadAuditoria;
  detalle: string;
  documentos_faltantes: string[];
}

export interface ReporteAuditoria {
  generated_at: string;
  total_hallazgos: number;
  por_severidad: { critico: number; alto: number; medio: number };
  por_regla: Record<ReglaAuditoria, number>;
  hallazgos: HallazgoAuditoria[];
}

const QUERY_KEY = ["auditoria", "embarques"] as const;

async function fetchAuditoria(): Promise<ReporteAuditoria> {
  const { data, error } = await supabase.rpc("auditoria_embarques_org");
  if (error) throw error;
  return data as unknown as ReporteAuditoria;
}

/**
 * Reporte completo de auditoría operativa. Cache 5 min compartida con
 * useAuditoriaCount() para que el badge del sidebar no genere round-trips extra.
 */
export function useAuditoria() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAuditoria,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

/**
 * Devuelve solo el total de hallazgos. Reusa la misma query, así que si la
 * página /auditoria ya cargó los datos, el badge los lee del cache sin tocar la red.
 */
export function useAuditoriaCount() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAuditoria,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    select: (data) => data.total_hallazgos,
  });
}

export const AUDITORIA_QUERY_KEY = QUERY_KEY;
