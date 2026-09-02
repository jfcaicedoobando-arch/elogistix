import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchReportesResumen } from "@/features/reportes/services";

interface FiltrosRentabilidad {
  fechaDesde?: string;
  fechaHasta?: string;
  modo?: string;
}

import type { RentabilidadCliente } from "@/types/rentabilidad";
;

/**
 * v8.173.0 (Ola B.4): consume el RPC `reportes_resumen` que devuelve filas +
 * KPIs agregados en una sola llamada. Antes la agregación se hacía
 * client-side a partir de `profit_por_cliente`.
 */
export function useRentabilidadClientes(filtros: FiltrosRentabilidad) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.reportes.rentabilidadClientes(filtros),
    queryFn: () => fetchReportesResumen(filtros),
  });

  const clientes: RentabilidadCliente[] = useMemo(
    () => data?.clientes ?? [],
    [data],
  );

  const kpis = useMemo(
    () => data?.kpis ?? { totalClientes: 0, revenue: 0, profit: 0, margenProm: 0, embarquesSinTc: 0 },
    [data],
  );

  return { clientes, kpis, isLoading, isError, refetch };
}
