import { useQueries, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AUDITORIA_REVISIONES_KEY,
  hallazgoHash,
  type AuditoriaRevision,
} from "@/hooks/auditoria/useAuditoriaRevisiones";

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
 * Devuelve el total de hallazgos PENDIENTES (excluye los ya marcados como
 * revisados). Reusa la misma query del reporte y la de revisiones, así que si
 * /auditoria ya cargó los datos, el badge los lee del cache sin tocar la red.
 */
export function useAuditoriaCount() {
  const results = useQueries({
    queries: [
      {
        queryKey: QUERY_KEY,
        queryFn: fetchAuditoria,
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
      },
      {
        queryKey: AUDITORIA_REVISIONES_KEY,
        queryFn: async (): Promise<Map<string, AuditoriaRevision>> => {
          const { data, error } = await supabase
            .from("auditoria_revisiones")
            .select("*")
            .order("created_at", { ascending: false });
          if (error) throw error;
          const map = new Map<string, AuditoriaRevision>();
          for (const r of (data ?? []) as AuditoriaRevision[]) {
            map.set(`${r.embarque_id}|${r.regla}|${r.detalle_hash}`, r);
          }
          return map;
        },
        staleTime: 60_000,
      },
    ],
  });
  const reporte = results[0].data as ReporteAuditoria | undefined;
  const revisiones = results[1].data as Map<string, AuditoriaRevision> | undefined;

  if (!reporte) return { data: undefined, isLoading: results[0].isLoading };

  if (!revisiones || revisiones.size === 0) {
    return { data: reporte.total_hallazgos, isLoading: false };
  }

  let pendientes = 0;
  for (const h of reporte.hallazgos) {
    const key = `${h.embarque_id}|${h.regla}|${hallazgoHash(h)}`;
    if (!revisiones.has(key)) pendientes++;
  }
  return { data: pendientes, isLoading: false };
}

export const AUDITORIA_QUERY_KEY = QUERY_KEY;
