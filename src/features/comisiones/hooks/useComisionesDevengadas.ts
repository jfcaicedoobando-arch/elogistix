/**
 * Hooks de comisiones: devengadas + KPIs.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchComisionesDevengadas,
  fetchComisionesKpiRows,
  fetchLiquidadoMxnPorMes,
  calcularKPIsComisiones,
  type FetchComisionesFiltros,
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

  // BL-7: el KPI "liquidado del mes" se lee de las liquidaciones pagadas en el
  // mes (`fecha_pago`), no del devengo de las comisiones.
  const periodo = filtros.periodo;
  const liquidado = useQuery({
    queryKey: queryKeys.comisiones.liquidaciones({ liquidadoMes: periodo ?? "actual" }),
    queryFn: () => fetchLiquidadoMxnPorMes(periodo),
    staleTime: 30_000,
  });

  // Hallazgo 6: el KPI se mide contra el periodo consultado, no contra hoy.
  // Defecto 3: los KPIs ya NO se calculan sobre la lista visible (tope de 500
  // filas), sino sobre una lectura completa y ligera con los mismos filtros.
  const kpiRows = useQuery({
    queryKey: queryKeys.comisiones.devengadas({ ...key, kpis: true }),
    queryFn: () => fetchComisionesKpiRows(filtros),
    staleTime: 30_000,
  });

  const base = useMemo(() => calcularKPIsComisiones(kpiRows.data ?? [], periodo), [kpiRows.data, periodo]);
  const kpis = useMemo(
    () => ({ ...base, liquidado_mes_mxn: liquidado.data ?? 0 }),
    [base, liquidado.data],
  );
  return { ...q, kpis };
}
