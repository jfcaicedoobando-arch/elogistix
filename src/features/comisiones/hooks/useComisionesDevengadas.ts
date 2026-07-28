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
} from "@/features/comisiones/services";

export function useComisionesDevengadas(filtros: FetchComisionesFiltros = {}) {
  // SAFE: filtros se desestructura en primitivos antes del useMemo para evitar
  // dependencias inestables y satisfacer react-hooks/exhaustive-deps.
  const key = useMemo(
    () => ({ vendedora_id: filtros.vendedora_id, estado: filtros.estado, periodo: filtros.periodo }),
    [filtros.vendedora_id, filtros.estado, filtros.periodo],
  );
  const q = useQuery({
    queryKey: queryKeys.comisiones.devengadas(key),
    queryFn: () => fetchComisionesDevengadas(filtros),
    staleTime: 30_000,
  });
  const kpis = useMemo(() => calcularKPIsComisiones(q.data ?? []), [q.data]);
  return { ...q, kpis };
}

;
