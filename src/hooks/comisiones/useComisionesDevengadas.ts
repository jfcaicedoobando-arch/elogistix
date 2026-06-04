/**
 * Hooks de comisiones: devengadas + KPIs.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchComisionesDevengadas,
  calcularKPIsComisiones,
  type FetchComisionesFiltros,
  type EstadoComision,
} from "@/services/comisiones";

export function useComisionesDevengadas(filtros: FetchComisionesFiltros = {}) {
  const key = useMemo(() => filtros, [
    filtros.vendedora_id, filtros.estado, filtros.periodo,
  ]);
  const q = useQuery({
    queryKey: queryKeys.comisiones.devengadas(key),
    queryFn: () => fetchComisionesDevengadas(filtros),
    staleTime: 30_000,
  });
  const kpis = useMemo(() => calcularKPIsComisiones(q.data ?? []), [q.data]);
  return { ...q, kpis };
}

export type { EstadoComision };
